import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import type { Socket } from 'socket.io-client';

import {
  chatApi,
  type ConversationDto,
  type GifItem,
  type GifKind,
  type MessageDto,
  type MessageMedia,
  type PresenceStatus,
  type QuotedMedia,
  type ReactionGroup,
  type ReactionUpdate,
  type ReadReceipt,
  type ReplyPreview,
} from '@/services/api/chat';
import { deleteFile } from '@/features/media/localFiles';
import type { LocalMedia } from '@/features/media/pickMedia';
import { uploadErrorMessage, uploadMedia } from '@/features/media/uploadMedia';
import { ApiError, refreshAccessToken } from '@/services/api/client';
import {
  createChatSocket,
  type SocketErrorData,
} from '@/services/realtime/chatSocket';
import { uuidv4 } from '@/utils/uuid';

import {
  type ChatMessage,
  type ChatState,
  chatStore,
  emptyThread,
  mergeMessages,
  myReaction,
  type PendingUpload,
  type ThreadState,
  toggleReaction,
} from './chatStore';

/** After this long in the background the socket closes; push takes over (ROUTING_CONVENTIONS.md). */
const BACKGROUND_DISCONNECT_MS = 30_000;
const TYPING_THROTTLE_MS = 3_000;
const TYPING_IDLE_MS = 4_000;
/** Safety net if a `typing.stop` is lost. */
const TYPING_EXPIRY_MS = 6_000;
const READ_DEBOUNCE_MS = 300;
const AUTH_RETRY_MS = 5_000;
const CATCH_UP_MAX_PAGES = 5;

let socket: Socket | null = null;
let appStateSub: NativeEventSubscription | null = null;
// iOS can report 'unknown' (or nothing) before the first native event; that's foreground.
const currentAppState = (): AppStateStatus => {
  const s = AppState.currentState as unknown;
  return s === 'background' || s === 'inactive' ? s : 'active';
};

let appState: AppStateStatus = currentAppState();
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
let authRetryTimer: ReturnType<typeof setTimeout> | null = null;
const readTimers = new Map<string, ReturnType<typeof setTimeout>>();
const typingExpiry = new Map<string, ReturnType<typeof setTimeout>>();
const typingSent = new Map<
  string,
  { at: number; idle: ReturnType<typeof setTimeout> }
>();

const set = chatStore.set;
const get = chatStore.get;

const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong.';

function patchThread(
  conversationId: string,
  patch: (t: ThreadState) => ThreadState,
) {
  set(s => ({
    ...s,
    threads: {
      ...s.threads,
      [conversationId]: patch(s.threads[conversationId] ?? emptyThread()),
    },
  }));
}

function addToThread(conversationId: string, messages: ChatMessage[]) {
  patchThread(conversationId, t => ({
    ...t,
    messages: mergeMessages(t.messages, messages),
  }));
}

const isViewing = (conversationId: string, s: ChatState = get()) =>
  s.activeConversationId === conversationId && appState === 'active';

function upsertConversations(list: ConversationDto[]) {
  if (!list.length) return;
  set(s => {
    const conversations = { ...s.conversations };
    for (const c of list) {
      // The open thread is read as messages arrive; don't flash an unread badge.
      conversations[c.id] = isViewing(c.id, s) ? { ...c, unread_count: 0 } : c;
    }
    return { ...s, conversations };
  });
}

function patchConversation(
  id: string,
  patch: (c: ConversationDto) => ConversationDto,
) {
  set(s => {
    const c = s.conversations[id];
    return c
      ? { ...s, conversations: { ...s.conversations, [id]: patch(c) } }
      : s;
  });
}

function setPreview(message: MessageDto) {
  patchConversation(message.conversation_id, c => {
    const last = c.last_message;
    if (last && last.created_at > message.created_at) return c;
    return {
      ...c,
      last_message: {
        id: message.id,
        sender_id: message.sender_id,
        type: message.type,
        body: message.body,
        is_deleted: message.is_deleted,
        created_at: message.created_at,
      },
    };
  });
}

function patchMessage(
  conversationId: string,
  messageId: string,
  patch: (m: ChatMessage) => ChatMessage,
) {
  patchThread(conversationId, t => {
    const index = t.messages.findIndex(m => m.id === messageId);
    if (index < 0) return t;
    const messages = t.messages.slice();
    messages[index] = patch(messages[index]!);
    return { ...t, messages };
  });
}

const markDeleted = (m: ChatMessage): ChatMessage =>
  m.is_deleted
    ? m
    : { ...m, is_deleted: true, body: '', media: null, media_items: [] };

/** Quotes pointing at an unsent message must not keep showing its text. */
function hideQuotesOf(conversationId: string, messageId: string) {
  patchThread(conversationId, t =>
    t.messages.some(m => m.reply_to?.id === messageId)
      ? {
          ...t,
          messages: t.messages.map(m =>
            m.reply_to?.id === messageId && m.reply_to
              ? {
                  ...m,
                  reply_to: {
                    ...m.reply_to,
                    body: '',
                    is_deleted: true,
                    media: null,
                  },
                }
              : m,
          ),
        }
      : t,
  );
}

function setReactions(
  conversationId: string,
  messageId: string,
  reactions: ReactionGroup[],
) {
  patchMessage(conversationId, messageId, m => ({ ...m, reactions }));
}

/** Applies an edit to the message itself and to every quote of it. */
function applyEdit(
  conversationId: string,
  messageId: string,
  body: string,
  editedAt: string | null,
) {
  patchThread(conversationId, t => ({
    ...t,
    messages: t.messages.map(m => {
      if (m.id === messageId) return { ...m, body, edited_at: editedAt };
      if (m.reply_to?.id === messageId) {
        return {
          ...m,
          reply_to: {
            ...m.reply_to,
            body: body.slice(0, 200),
            is_edited: Boolean(editedAt),
          },
        };
      }
      return m;
    }),
  }));
}

function onMessageUpdated(dto: MessageDto) {
  applyEdit(dto.conversation_id, dto.id, dto.body, dto.edited_at ?? null);
  if (dto.reactions) setReactions(dto.conversation_id, dto.id, dto.reactions);
}

function removeConversation(conversationId: string) {
  set(s => {
    if (!s.conversations[conversationId] && !s.threads[conversationId]) return s;
    const conversations = { ...s.conversations };
    const threads = { ...s.threads };
    delete conversations[conversationId];
    delete threads[conversationId];
    return { ...s, conversations, threads };
  });
}

function setTyping(conversationId: string, typing: boolean) {
  clearTimeout(typingExpiry.get(conversationId));
  typingExpiry.delete(conversationId);
  if (typing) {
    typingExpiry.set(
      conversationId,
      setTimeout(() => setTyping(conversationId, false), TYPING_EXPIRY_MS),
    );
  }
  set(s => {
    if (Boolean(s.typing[conversationId]) === typing) return s;
    const next = { ...s.typing };
    if (typing) next[conversationId] = true;
    else delete next[conversationId];
    return { ...s, typing: next };
  });
}

function applyPresence(list: PresenceStatus[]) {
  if (!list.length) return;
  set(s => {
    const presence = { ...s.presence };
    for (const p of list) presence[p.user_id] = p;
    return { ...s, presence };
  });
}

function subscribePresence(userIds?: string[]) {
  if (!socket?.connected) return;
  const ids =
    userIds ??
    Object.values(get().conversations)
      .map(c => c.peer?.id)
      .filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  socket.emit(
    'presence.subscribe',
    { user_ids: ids },
    (res: { data?: PresenceStatus[] }) => applyPresence(res?.data ?? []),
  );
}

/* ---------- Socket events ---------- */

function onMessageNew(dto: MessageDto) {
  const s = get();
  const id = dto.conversation_id;
  if (s.threads[id]?.loaded) addToThread(id, [{ ...dto, status: 'sent' }]);
  setPreview(dto);
  if (dto.sender_id !== s.meId) {
    setTyping(id, false);
    if (isViewing(id)) scheduleMarkRead(id);
  }
  if (!s.conversations[id]) {
    chatApi
      .getConversation(id)
      .then(c => upsertConversations([c]))
      .catch(() => undefined);
  }
}

function onRead(receipt: ReadReceipt) {
  if (receipt.user_id === get().meId) return;
  patchConversation(receipt.conversation_id, c => {
    const current = c.peer_last_read_message_id;
    return current && current >= receipt.last_read_message_id
      ? c
      : { ...c, peer_last_read_message_id: receipt.last_read_message_id };
  });
}

function onMessageDeleted(payload: {
  conversation_id: string;
  message_id: string;
}) {
  patchMessage(payload.conversation_id, payload.message_id, markDeleted);
  hideQuotesOf(payload.conversation_id, payload.message_id);
}

function onTyping(
  payload: { conversation_id: string; user_id: string },
  typing: boolean,
) {
  if (payload.user_id !== get().meId) setTyping(payload.conversation_id, typing);
}

async function onConnectError(err: Error & { data?: SocketErrorData }) {
  if (socket?.active) return; // Network error: Socket.IO retries on its own.
  const code = err.data?.code;
  if (code === 'ACCOUNT_DISABLED' || code === 'INVALID_REFRESH_TOKEN') return;
  try {
    // Expired or missing access token: rotate it, then reconnect with the new one.
    await refreshAccessToken();
    socket?.connect();
  } catch (refreshErr) {
    // A 401 here signs the user out (handled by the API client); otherwise try again shortly.
    if (refreshErr instanceof ApiError && refreshErr.status === 401) return;
    clearTimeout(authRetryTimer ?? undefined);
    authRetryTimer = setTimeout(() => socket?.connect(), AUTH_RETRY_MS);
  }
}

function resync() {
  chat.refreshInbox();
  const active = get().activeConversationId;
  if (active) {
    catchUp(active);
    if (appState === 'active') scheduleMarkRead(active);
  }
  subscribePresence();
}

type ExtraHandler = (payload: unknown) => void;
const extraHandlers = new Map<string, Set<ExtraHandler>>();
const connectHandlers = new Set<() => void>();

/** Listens to a server event on the shared socket (kept across reconnects and sign-ins). */
export function onSocketEvent(event: string, handler: ExtraHandler) {
  let handlers = extraHandlers.get(event);
  if (!handlers) {
    const created = new Set<ExtraHandler>();
    handlers = created;
    extraHandlers.set(event, created);
    socket?.on(event, (p: unknown) => created.forEach(h => h(p)));
  }
  const registered = handlers;
  registered.add(handler);
  return () => {
    registered.delete(handler);
  };
}

/** Runs after every (re)connect, so screens can refetch what they may have missed. */
export function onSocketReconnect(handler: () => void) {
  connectHandlers.add(handler);
  return () => {
    connectHandlers.delete(handler);
  };
}

function attachSocket(s: Socket) {
  extraHandlers.forEach((handlers, event) => {
    s.on(event, (p: unknown) => handlers.forEach(h => h(p)));
  });
  s.on('connect', () => {
    connectHandlers.forEach(h => h());
    set(st => ({ ...st, connected: true }));
    resync();
  });
  s.on('disconnect', reason => {
    set(st => ({ ...st, connected: false, typing: {} }));
    // The server closed us (deploy / restart): Socket.IO won't retry by itself.
    if (reason === 'io server disconnect' && appState === 'active') {
      setTimeout(() => socket?.connect(), AUTH_RETRY_MS);
    }
  });
  s.on('connect_error', err => onConnectError(err));
  s.on('message.new', onMessageNew);
  s.on('message.read', onRead);
  s.on('message.deleted', onMessageDeleted);
  s.on('message.updated', onMessageUpdated);
  s.on('message.reaction', (p: ReactionUpdate) =>
    setReactions(p.conversation_id, p.message_id, p.reactions),
  );
  s.on('conversation.updated', (c: ConversationDto) =>
    upsertConversations([c]),
  );
  s.on('conversation.deleted', (p: { conversation_id: string }) => {
    // Deleted from another device; keep it if it's open here (a new message brings it back).
    if (get().activeConversationId !== p.conversation_id) {
      removeConversation(p.conversation_id);
    }
  });
  s.on('typing.start', p => onTyping(p, true));
  s.on('typing.stop', p => onTyping(p, false));
  s.on('presence.update', (p: PresenceStatus) => applyPresence([p]));
}

function onAppStateChange(next: AppStateStatus) {
  const wasActive = appState === 'active';
  appState = next;
  if (next === 'active') {
    clearTimeout(backgroundTimer ?? undefined);
    backgroundTimer = null;
    if (socket && !socket.connected) socket.connect();
    else if (!wasActive) resync();
    return;
  }
  if (wasActive && !backgroundTimer) {
    backgroundTimer = setTimeout(() => {
      backgroundTimer = null;
      socket?.disconnect();
    }, BACKGROUND_DISCONNECT_MS);
  }
}

/* ---------- Threads ---------- */

function newestServerId(conversationId: string) {
  return get().threads[conversationId]?.messages.find(
    m => m.status === 'sent',
  )?.id;
}

async function loadInitial(conversationId: string) {
  patchThread(conversationId, t => ({ ...t, error: null }));
  try {
    const page = await chatApi.listMessages(conversationId);
    patchThread(conversationId, t => ({
      ...t,
      messages: mergeMessages(
        t.messages,
        page.data.map(m => ({ ...m, status: 'sent' as const })),
      ),
      loaded: true,
      hasMore: page.pagination.has_more,
      nextCursor: page.pagination.next_cursor,
      error: null,
    }));
  } catch (err) {
    patchThread(conversationId, t => ({ ...t, error: errorMessage(err) }));
  }
}

/** Fetches what arrived while the socket was down. */
async function catchUp(conversationId: string) {
  const thread = get().threads[conversationId];
  if (!thread?.loaded) return loadInitial(conversationId);
  let after = newestServerId(conversationId);
  if (!after) return loadInitial(conversationId);
  try {
    for (let i = 0; i < CATCH_UP_MAX_PAGES && after; i++) {
      const page = await chatApi.listMessages(conversationId, {
        after,
        limit: 50,
      });
      addToThread(
        conversationId,
        page.data.map(m => ({ ...m, status: 'sent' as const })),
      );
      after = page.pagination.has_more
        ? page.pagination.next_cursor ?? undefined
        : undefined;
    }
  } catch {
    // Next reconnect or screen focus tries again.
  }
}

function scheduleMarkRead(conversationId: string) {
  patchConversation(conversationId, c =>
    c.unread_count ? { ...c, unread_count: 0 } : c,
  );
  clearTimeout(readTimers.get(conversationId));
  readTimers.set(
    conversationId,
    setTimeout(() => {
      readTimers.delete(conversationId);
      chatApi.markRead(conversationId).catch(() => undefined);
    }, READ_DEBOUNCE_MS),
  );
}

/** Uploads in one chat go up one at a time, so photos arrive in the order they were picked. */
const uploadQueues = new Map<string, Promise<void>>();

function enqueueUpload(message: ChatMessage) {
  const id = message.conversation_id;
  const next = (uploadQueues.get(id) ?? Promise.resolve()).then(() =>
    deliver(message),
  );
  uploadQueues.set(id, next);
  next.finally(() => {
    if (uploadQueues.get(id) === next) uploadQueues.delete(id);
  });
}

const PROGRESS_STEP = 0.04;

/** Two album files upload at once. A retry skips files already stored. */
const UPLOAD_CONCURRENCY = 2;

/**
 * Uploads each file once, two at a time. A retry skips files already stored.
 * Progress is the average across the album.
 */
async function uploadFor(message: ChatMessage): Promise<ChatMessage> {
  const upload = message.upload;
  if (!upload) return message;
  const items = upload.items.slice();
  const total = items.length;
  let current = message;
  let shown = upload.progress;
  const report = (fraction: number) => {
    if (fraction - shown < PROGRESS_STEP && fraction < 1) return;
    shown = fraction;
    patchMessage(message.conversation_id, message.id, m =>
      m.upload ? { ...m, upload: { ...m.upload, progress: fraction } } : m,
    );
  };

  const fractions: number[] = items.map(item => (item.mediaId ? 1 : 0));
  const sumFractions = () => fractions.reduce((acc, fraction) => acc + fraction, 0);
  const pending = items.map((_, idx) => idx).filter(idx => !items[idx]?.mediaId);

  const uploadWorker = async () => {
    for (let idx = pending.shift(); idx !== undefined; idx = pending.shift()) {
      const item = items[idx]!;
      const asset = await uploadMedia(item.file, 'message', {
        session: item.session,
        onProgress: fraction => {
          fractions[idx] = fraction;
          report(sumFractions() / total);
        },
      });
      items[idx] = { ...item, mediaId: asset.id };
      fractions[idx] = 1;
      const sized = (m: MessageMedia): MessageMedia => ({
        ...m,
        width: asset.width ?? m.width,
        height: asset.height ?? m.height,
        duration_ms: asset.duration_ms ?? m.duration_ms,
      });
      current = {
        ...current,
        upload: { items: items.slice(), progress: sumFractions() / total },
        media: current.media && total === 1 ? sized(current.media) : current.media,
        media_items: current.media_items?.map((m, j) => (j === idx ? sized(m) : m)),
      };
      // Keep finished ids on the message, so a failure later in the album doesn't redo them.
      const done = current.upload;
      patchMessage(message.conversation_id, message.id, m =>
        m.upload ? { ...m, upload: done } : m,
      );
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, () =>
      uploadWorker(),
    ),
  );
  return current;
}

async function deliver(original: ChatMessage) {
  let message = original;
  const gif =
    (message.type === 'gif' || message.type === 'sticker') && message.media
      ? {
          kind: message.type,
          id: message.media.provider_id ?? '',
          url: message.media.url,
          preview_url: message.media.preview_url,
          width: message.media.width ?? 200,
          height: message.media.height ?? 200,
        }
      : undefined;
  try {
    if (message.upload) message = await uploadFor(message);
    const ids = (message.upload?.items ?? []).map(i => i.mediaId!);
    const saved = await chatApi.sendMessage(message.conversation_id, {
      body: message.body || undefined,
      client_message_id: message.client_message_id,
      reply_to_id: message.reply_to_id ?? undefined,
      reply_to_index:
        message.reply_to_id && message.reply_to_index != null
          ? message.reply_to_index
          : undefined,
      media_id: ids.length === 1 ? ids[0] : undefined,
      media_ids: ids.length > 1 ? ids : undefined,
      gif,
    });
    // A recording is only needed until it's stored; play it back from the server after that.
    const keepLocal = message.upload?.items[0]?.file.kind !== 'audio';
    if (!keepLocal && message.localUri) deleteFile(message.localUri).catch(() => {});
    addToThread(message.conversation_id, [
      {
        ...saved,
        status: 'sent',
        localUri: keepLocal ? message.localUri : undefined,
        localUris: message.localUris,
      },
    ]);
    setPreview(saved);
  } catch (err) {
    // The quoted message was unsent meanwhile: send it as a plain message instead.
    if (
      err instanceof ApiError &&
      err.code === 'REPLY_TARGET_NOT_FOUND' &&
      message.reply_to_id
    ) {
      const plain = {
        ...message,
        reply_to_id: null,
        reply_to_index: null,
        reply_to: null,
      };
      addToThread(message.conversation_id, [plain]);
      return deliver(plain);
    }
    // Album files stored before the failure are recorded on the live message only.
    const live = get().threads[message.conversation_id]?.messages.find(
      m => m.id === message.id,
    );
    addToThread(message.conversation_id, [
      {
        ...message,
        upload: live?.upload ?? message.upload,
        status: 'failed',
        failure: message.upload ? uploadErrorMessage(err) : undefined,
      },
    ]);
  }
}

/** The same thumbnail the server sends with a quote, so the optimistic bubble matches. */
function quotedMediaOf(m: ChatMessage, index: number | null): QuotedMedia | null {
  const items = m.media_items ?? [];
  if (items.length) {
    const picked = index != null ? items[index] : undefined;
    const shown = picked ?? items[0]!;
    const next = picked ? undefined : items[1];
    const card = (item: MessageMedia) => ({
      url: item.preview_url ?? item.url,
      kind: item.duration_ms != null ? ('video' as const) : ('image' as const),
    });
    return {
      ...card(shown),
      count: picked ? 1 : items.length,
      next_url: next ? next.preview_url ?? next.url : null,
      stack: picked ? [] : items.slice(0, 3).map(card),
    };
  }
  if (m.media && ['image', 'video', 'gif', 'sticker'].includes(m.type)) {
    return {
      url: m.media.preview_url ?? m.media.url,
      kind: m.type === 'video' ? 'video' : 'image',
      count: 1,
      next_url: null,
      stack: [],
    };
  }
  return null;
}

function replyPreviewOf(
  m: ChatMessage | null | undefined,
  index: number | null = null,
): ReplyPreview | null {
  if (!m || m.status !== 'sent' || m.is_deleted) return null;
  return {
    id: m.id,
    sender_id: m.sender_id,
    type: m.type,
    body: m.body.slice(0, 200),
    is_deleted: false,
    is_edited: Boolean(m.edited_at),
    media: quotedMediaOf(m, index),
  };
}

let lastLocalTime = 0;
/** Several files sent at once must keep their order, so no two get the same timestamp. */
function nextLocalTime() {
  lastLocalTime = Math.max(Date.now(), lastLocalTime + 1);
  return new Date(lastLocalTime).toISOString();
}

function sendOptimistic(
  conversationId: string,
  content: Pick<ChatMessage, 'type' | 'body' | 'media'> &
    Partial<Pick<ChatMessage, 'media_items' | 'upload' | 'localUri' | 'localUris'>>,
  replyTo?: ChatMessage | null,
  replyIndex: number | null = null,
) {
  const meId = get().meId;
  if (!meId) return;
  chat.stopTyping(conversationId);
  const clientId = uuidv4();
  const index =
    replyIndex != null && replyIndex < (replyTo?.media_items?.length ?? 0)
      ? replyIndex
      : null;
  const reply = replyPreviewOf(replyTo, index);
  const message: ChatMessage = {
    id: `local:${clientId}`,
    conversation_id: conversationId,
    sender_id: meId,
    ...content,
    reply_to_id: reply?.id ?? null,
    reply_to_index: reply ? index : null,
    reply_to: reply,
    client_message_id: clientId,
    is_deleted: false,
    created_at: nextLocalTime(),
    status: 'sending',
  };
  addToThread(conversationId, [message]);
  setPreview(message);
  if (message.upload) enqueueUpload(message);
  else deliver(message);
}

const MESSAGE_TYPE_OF = {
  image: 'image',
  video: 'video',
  audio: 'voice',
} as const;

/** Matches the server's limit on files per message. */
const MAX_ALBUM = 10;

function localMediaOf(file: LocalMedia): MessageMedia {
  return {
    provider: 'upload',
    provider_id: null,
    media_id: null,
    url: file.uri,
    preview_url: null,
    width: file.width ?? null,
    height: file.height ?? null,
    duration_ms: file.kind === 'image' ? null : file.durationMs ?? 0,
  };
}

/* ---------- Public API ---------- */

export const chat = {
  start(meId: string) {
    chat.stop();
    chatStore.reset(meId);
    appState = currentAppState();
    socket = createChatSocket();
    attachSocket(socket);
    socket.connect();
    appStateSub = AppState.addEventListener('change', onAppStateChange);
    chat.refreshInbox();
  },

  stop() {
    appStateSub?.remove();
    appStateSub = null;
    [backgroundTimer, authRetryTimer].forEach(t => clearTimeout(t ?? undefined));
    backgroundTimer = authRetryTimer = null;
    readTimers.forEach(clearTimeout);
    readTimers.clear();
    typingExpiry.forEach(clearTimeout);
    typingExpiry.clear();
    typingSent.forEach(t => clearTimeout(t.idle));
    typingSent.clear();
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    chatStore.reset(null);
  },

  async refreshInbox() {
    set(s =>
      s.inbox.status === 'ready'
        ? s
        : { ...s, inbox: { ...s.inbox, status: 'loading', error: null } },
    );
    try {
      const page = await chatApi.listConversations();
      upsertConversations(page.data);
      set(s => ({
        ...s,
        inbox: {
          status: 'ready',
          error: null,
          nextCursor: page.pagination.next_cursor,
          hasMore: page.pagination.has_more,
        },
      }));
      subscribePresence(page.data.map(c => c.peer?.id).filter(Boolean) as string[]);
    } catch (err) {
      set(s => ({
        ...s,
        inbox: {
          ...s.inbox,
          status: s.inbox.status === 'ready' ? 'ready' : 'error',
          error: errorMessage(err),
        },
      }));
    }
  },

  async loadMoreInbox() {
    const { nextCursor, hasMore } = get().inbox;
    if (!hasMore || !nextCursor) return;
    try {
      const page = await chatApi.listConversations(nextCursor);
      upsertConversations(page.data);
      set(s => ({
        ...s,
        inbox: {
          ...s.inbox,
          nextCursor: page.pagination.next_cursor,
          hasMore: page.pagination.has_more,
        },
      }));
    } catch {
      // The list keeps what it has; scrolling again retries.
    }
  },

  /** Opens (or creates) the direct conversation with a person and returns its id. */
  async openDirect(userId: string) {
    const convo = await chatApi.openDirect(userId);
    upsertConversations([convo]);
    return convo.id;
  },

  openThread(conversationId: string) {
    set(s => ({ ...s, activeConversationId: conversationId }));
    if (!get().conversations[conversationId]) {
      chatApi
        .getConversation(conversationId)
        .then(c => {
          upsertConversations([c]);
          if (c.peer) subscribePresence([c.peer.id]);
        })
        .catch(err =>
          patchThread(conversationId, t => ({
            ...t,
            error: errorMessage(err),
          })),
        );
    } else {
      const peer = get().conversations[conversationId]?.peer;
      if (peer) subscribePresence([peer.id]);
    }
    catchUp(conversationId);
    if (appState === 'active') scheduleMarkRead(conversationId);
  },

  closeThread(conversationId: string) {
    chat.stopTyping(conversationId);
    set(s =>
      s.activeConversationId === conversationId
        ? { ...s, activeConversationId: null }
        : s,
    );
  },

  retryThread(conversationId: string) {
    loadInitial(conversationId);
    if (!get().conversations[conversationId]) chat.openThread(conversationId);
  },

  async loadOlder(conversationId: string) {
    const thread = get().threads[conversationId];
    if (!thread?.loaded || thread.loadingOlder || !thread.hasMore) return;
    patchThread(conversationId, t => ({ ...t, loadingOlder: true }));
    try {
      const page = await chatApi.listMessages(conversationId, {
        cursor: thread.nextCursor ?? undefined,
      });
      patchThread(conversationId, t => ({
        ...t,
        messages: mergeMessages(
          t.messages,
          page.data.map(m => ({ ...m, status: 'sent' as const })),
        ),
        loadingOlder: false,
        hasMore: page.pagination.has_more,
        nextCursor: page.pagination.next_cursor,
      }));
    } catch {
      patchThread(conversationId, t => ({ ...t, loadingOlder: false }));
    }
  },

  /** `replyIndex` quotes one photo / video of an album instead of the whole stack. */
  send(
    conversationId: string,
    text: string,
    replyTo?: ChatMessage | null,
    replyIndex: number | null = null,
  ) {
    const body = text.trim();
    if (!body) return;
    sendOptimistic(
      conversationId,
      { type: 'text', body, media: null },
      replyTo,
      replyIndex,
    );
  },

  sendGif(
    conversationId: string,
    gif: GifItem,
    replyTo?: ChatMessage | null,
    kind: GifKind = 'gif',
  ) {
    sendOptimistic(
      conversationId,
      {
        type: kind,
        body: '',
        media: {
          provider: 'giphy',
          provider_id: gif.id,
          media_id: null,
          url: gif.url,
          preview_url: gif.preview_url,
          width: gif.width,
          height: gif.height,
          duration_ms: null,
        },
      },
      replyTo,
    );
  },

  /**
   * Several photos / videos go as one album (Instagram's stack); one file or a
   * voice note is a message of its own. Uploads run in order.
   */
  sendFiles(
    conversationId: string,
    files: readonly LocalMedia[],
    replyTo?: ChatMessage | null,
  ) {
    const visual = files.filter(f => f.kind !== 'audio');
    const voice = files.filter(f => f.kind === 'audio');
    const albums: LocalMedia[][] = [];
    for (let i = 0; i < visual.length; i += MAX_ALBUM) {
      albums.push(visual.slice(i, i + MAX_ALBUM));
    }
    const groups = [...albums, ...voice.map(f => [f])];
    groups.forEach((group, i) => {
      const quote = i === 0 ? replyTo : null;
      const upload: PendingUpload = {
        items: group.map(file => ({ file, session: {} })),
        progress: 0,
      };
      if (group.length === 1) {
        const file = group[0]!;
        sendOptimistic(
          conversationId,
          {
            type: MESSAGE_TYPE_OF[file.kind],
            body: '',
            media: localMediaOf(file),
            localUri: file.uri,
            upload,
          },
          quote,
        );
        return;
      }
      sendOptimistic(
        conversationId,
        {
          type: 'album',
          body: '',
          media: null,
          media_items: group.map(localMediaOf),
          localUris: group.map(f => f.uri),
          upload,
        },
        quote,
      );
    });
  },

  /** Removes my message for everyone. Optimistic; restored if the server refuses. */
  async unsend(conversationId: string, messageId: string) {
    const before = get();
    const original = before.threads[conversationId]?.messages.find(
      m => m.id === messageId,
    );
    if (!original || original.status !== 'sent') return;
    const threadBefore = before.threads[conversationId]!;
    const convoBefore = before.conversations[conversationId];
    patchMessage(conversationId, messageId, markDeleted);
    hideQuotesOf(conversationId, messageId);
    const last = get().conversations[conversationId]?.last_message;
    if (last?.id === messageId) {
      // Unsent messages vanish: preview the previous one (the server confirms it).
      const previous = threadBefore.messages.find(
        m => m.id !== messageId && !m.is_deleted && m.status === 'sent',
      );
      patchConversation(conversationId, c => ({
        ...c,
        last_message: previous
          ? {
              id: previous.id,
              sender_id: previous.sender_id,
              type: previous.type,
              body: previous.body,
              is_deleted: false,
              created_at: previous.created_at,
            }
          : null,
      }));
    }
    try {
      await chatApi.unsend(conversationId, messageId);
    } catch (err) {
      // Restore the bubble, quotes and preview, keeping anything that arrived meanwhile.
      patchThread(conversationId, t => ({
        ...t,
        messages: t.messages.map(
          m => threadBefore.messages.find(p => p.id === m.id) ?? m,
        ),
      }));
      if (convoBefore && last?.id === messageId) {
        patchConversation(conversationId, c =>
          !c.last_message || c.last_message.created_at <= last.created_at
            ? { ...c, last_message: convoBefore.last_message }
            : c,
        );
      }
      throw err;
    }
  },

  /**
   * Toggles my reaction (Instagram rules: same emoji removes it, another replaces it).
   * Optimistic; rolled back if the server refuses.
   */
  async react(conversationId: string, messageId: string, emoji: string) {
    const meId = get().meId;
    const message = get().threads[conversationId]?.messages.find(
      m => m.id === messageId,
    );
    if (!meId || !message || message.status !== 'sent' || message.is_deleted)
      return;
    const before = message.reactions ?? [];
    const removing = myReaction(before, meId) === emoji;
    setReactions(conversationId, messageId, toggleReaction(before, meId, emoji));
    try {
      const res = removing
        ? await chatApi.unreact(conversationId, messageId)
        : await chatApi.react(conversationId, messageId, emoji);
      setReactions(conversationId, messageId, res.reactions);
    } catch (err) {
      setReactions(conversationId, messageId, before);
      throw err;
    }
  },

  /** Edits my text message. Optimistic; restored if the server refuses. */
  async edit(conversationId: string, messageId: string, text: string) {
    const body = text.trim();
    const message = get().threads[conversationId]?.messages.find(
      m => m.id === messageId,
    );
    if (!body || !message || message.status !== 'sent' || message.is_deleted)
      return;
    if (body === message.body) return;
    const previous = { body: message.body, editedAt: message.edited_at ?? null };
    const convoBefore = get().conversations[conversationId];
    const isLast = convoBefore?.last_message?.id === messageId;
    applyEdit(conversationId, messageId, body, new Date().toISOString());
    if (isLast) {
      patchConversation(conversationId, c =>
        c.last_message ? { ...c, last_message: { ...c.last_message, body } } : c,
      );
    }
    try {
      const saved = await chatApi.editMessage(conversationId, messageId, body);
      applyEdit(conversationId, messageId, saved.body, saved.edited_at ?? null);
    } catch (err) {
      applyEdit(conversationId, messageId, previous.body, previous.editedAt);
      if (isLast && convoBefore) {
        patchConversation(conversationId, c =>
          c.last_message?.id === messageId
            ? { ...c, last_message: convoBefore.last_message }
            : c,
        );
      }
      throw err;
    }
  },

  /**
   * Makes sure a message (e.g. the original of a quote) is in the loaded thread,
   * paging older messages as needed. Resolves to whether it was found.
   */
  async ensureLoaded(conversationId: string, messageId: string, maxPages = 10) {
    let pages = 0;
    for (let guard = 0; guard < maxPages * 4; guard++) {
      const t = get().threads[conversationId];
      if (!t) return false;
      if (t.messages.some(m => m.id === messageId)) return true;
      if (t.loadingOlder) {
        await new Promise<void>(r => setTimeout(r, 120));
        continue;
      }
      if (!t.hasMore || pages >= maxPages) return false;
      pages++;
      await chat.loadOlder(conversationId);
    }
    return false;
  },

  async setMuted(conversationId: string, muted: boolean) {
    patchConversation(conversationId, c => ({ ...c, is_muted: muted }));
    try {
      upsertConversations([await chatApi.setMuted(conversationId, muted)]);
    } catch (err) {
      patchConversation(conversationId, c => ({ ...c, is_muted: !muted }));
      throw err;
    }
  },

  async deleteForMe(conversationId: string) {
    const snapshot = get().conversations[conversationId];
    removeConversation(conversationId);
    try {
      await chatApi.deleteForMe(conversationId);
    } catch (err) {
      if (snapshot) upsertConversations([snapshot]);
      throw err;
    }
  },

  /** Re-asks the server who is online (e.g. when a screen regains focus). */
  refreshPresence(userIds?: string[]) {
    subscribePresence(userIds);
  },

  retry(conversationId: string, clientMessageId: string) {
    const message = get().threads[conversationId]?.messages.find(
      m => m.client_message_id === clientMessageId && m.status === 'failed',
    );
    if (!message) return;
    const sending = {
      ...message,
      status: 'sending' as const,
      failure: undefined,
    };
    addToThread(conversationId, [sending]);
    if (sending.upload) enqueueUpload(sending);
    else deliver(sending);
  },

  /** Call on every keystroke; throttled to one `typing.start` per few seconds. */
  notifyTyping(conversationId: string) {
    if (!socket?.connected) return;
    const now = Date.now();
    const current = typingSent.get(conversationId);
    if (current) clearTimeout(current.idle);
    const idle = setTimeout(
      () => chat.stopTyping(conversationId),
      TYPING_IDLE_MS,
    );
    if (!current || now - current.at > TYPING_THROTTLE_MS) {
      socket.emit('typing.start', { conversation_id: conversationId });
      typingSent.set(conversationId, { at: now, idle });
    } else {
      typingSent.set(conversationId, { at: current.at, idle });
    }
  },

  stopTyping(conversationId: string) {
    const current = typingSent.get(conversationId);
    if (!current) return;
    clearTimeout(current.idle);
    typingSent.delete(conversationId);
    socket?.emit('typing.stop', { conversation_id: conversationId });
  },
};
