import { useSyncExternalStore } from 'react';

import type { LocalMedia } from '@/features/media/pickMedia';
import type { UploadSession } from '@/features/media/uploadMedia';

import type {
  ChatUser,
  ConversationDto,
  MessageDto,
  PresenceStatus,
  ReactionGroup,
} from '@/services/api/chat';

export type DeliveryStatus = 'sending' | 'sent' | 'failed';

export type PendingFile = {
  file: LocalMedia;
  session: UploadSession;
  /** Set once the file is stored, so a retry skips it. */
  mediaId?: string;
};

/** Photos, videos or a voice note of mine still going up; kept so a retry resumes them. */
export type PendingUpload = {
  /** One file, or the album items in order. */
  items: PendingFile[];
  /** 0–1 across all items. */
  progress: number;
};

export type ChatMessage = MessageDto & {
  status: DeliveryStatus;
  upload?: PendingUpload;
  /** The file on this device, shown instead of the remote copy so the bubble doesn't reload. */
  localUri?: string;
  /** Same as `localUri`, per album item. */
  localUris?: string[];
  /** Why the last attempt failed, when there is something useful to say. */
  failure?: string;
};

export type ThreadState = {
  /** Newest first, matching the inverted list. */
  messages: ChatMessage[];
  loaded: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  error: string | null;
};

export type ChatState = {
  meId: string | null;
  conversations: Record<string, ConversationDto>;
  inbox: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    nextCursor: string | null;
    hasMore: boolean;
  };
  threads: Record<string, ThreadState>;
  /** Conversation ids where the other person is typing right now. */
  typing: Record<string, true>;
  presence: Record<string, PresenceStatus>;
  connected: boolean;
  activeConversationId: string | null;
};

const initialState = (meId: string | null = null): ChatState => ({
  meId,
  conversations: {},
  inbox: { status: 'idle', error: null, nextCursor: null, hasMore: false },
  threads: {},
  typing: {},
  presence: {},
  connected: false,
  activeConversationId: null,
});

let state = initialState();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const chatStore = {
  get: () => state,
  set(updater: (s: ChatState) => ChatState) {
    const next = updater(state);
    if (next === state) return;
    state = next;
    emit();
  },
  reset(meId: string | null = null) {
    state = initialState(meId);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Selectors must return stable references (store slices), not newly built objects. */
export function useChatStore<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () =>
    selector(chatStore.get()),
  );
}

export const emptyThread = (): ThreadState => ({
  messages: [],
  loaded: false,
  loadingOlder: false,
  hasMore: false,
  nextCursor: null,
  error: null,
});

const messageKey = (m: MessageDto) => `${m.sender_id}:${m.client_message_id}`;

/**
 * Merges messages by sender + client id, so the server copy replaces the
 * optimistic bubble. Unsent bubbles stay at the newest end.
 */
export function mergeMessages(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const byKey = new Map(current.map(m => [messageKey(m), m]));
  for (const m of incoming) {
    const existing = byKey.get(messageKey(m));
    // A late optimistic update must never downgrade a delivered message.
    if (existing?.status === 'sent' && m.status !== 'sent') continue;
    let next = m;
    if (existing?.localUri && !('localUri' in m) && m.media) {
      next = { ...next, localUri: existing.localUri };
    }
    if (existing?.localUris && !('localUris' in m) && m.media_items?.length) {
      next = { ...next, localUris: existing.localUris };
    }
    byKey.set(messageKey(m), next);
  }
  return [...byKey.values()].sort((a, b) => {
    const pendingA = a.status !== 'sent';
    const pendingB = b.status !== 'sent';
    if (pendingA !== pendingB) return pendingA ? -1 : 1;
    if (a.created_at !== b.created_at)
      return a.created_at < b.created_at ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** My current reaction on a message, if any. */
export function myReaction(
  groups: readonly ReactionGroup[] | undefined,
  userId: string | null,
) {
  if (!userId) return null;
  return groups?.find(g => g.user_ids.includes(userId))?.emoji ?? null;
}

/**
 * One reaction per person: the same emoji again removes it, another emoji replaces it.
 * Empty groups are dropped; a new emoji goes to the end.
 */
export function toggleReaction(
  groups: readonly ReactionGroup[] | undefined,
  userId: string,
  emoji: string,
): ReactionGroup[] {
  const current = myReaction(groups, userId);
  const without = (groups ?? [])
    .map(g =>
      g.user_ids.includes(userId)
        ? {
            ...g,
            user_ids: g.user_ids.filter(id => id !== userId),
            count: g.count - 1,
          }
        : g,
    )
    .filter(g => g.count > 0);
  if (current === emoji) return without;
  const existing = without.find(g => g.emoji === emoji);
  if (!existing) {
    return [...without, { emoji, user_ids: [userId], count: 1 }];
  }
  return without.map(g =>
    g === existing
      ? { ...g, user_ids: [...g.user_ids, userId], count: g.count + 1 }
      : g,
  );
}

/** Own text messages can be edited for 15 minutes (matches the server). */
export const EDIT_WINDOW_MS = 15 * 60_000;

export function canEdit(m: ChatMessage, meId: string | null, now = Date.now()) {
  return (
    m.sender_id === meId &&
    m.type === 'text' &&
    m.status === 'sent' &&
    !m.is_deleted &&
    now - Date.parse(m.created_at) < EDIT_WINDOW_MS
  );
}

/** ObjectIds are time-ordered hex strings of equal length. */
export const isAtOrAfter = (a: string, b: string) => a >= b;

export function presenceOf(
  user: ChatUser | null | undefined,
  presence: Record<string, PresenceStatus>,
) {
  if (!user) return { online: false, lastActiveAt: null as string | null };
  const live = presence[user.id];
  return {
    online: live?.is_online ?? user.is_online ?? false,
    lastActiveAt: live?.last_active_at ?? user.last_active_at,
  };
}
