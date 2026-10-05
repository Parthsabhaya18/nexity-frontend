import type {
  ConversationDto,
  GifItem,
  MessageDto,
} from '../src/services/api/chat';

type Handler = (...args: any[]) => void;

const mockHandlers: Record<string, Handler[]> = {};
const mockSocket = {
  connected: false,
  active: false,
  on: jest.fn((event: string, handler: Handler) => {
    (mockHandlers[event] ??= []).push(handler);
  }),
  emit: jest.fn(),
  connect: jest.fn(() => {
    mockSocket.connected = true;
    mockHandlers.connect?.forEach(h => h());
  }),
  disconnect: jest.fn(() => {
    mockSocket.connected = false;
  }),
  removeAllListeners: jest.fn(() => {
    Object.keys(mockHandlers).forEach(k => delete mockHandlers[k]);
  }),
};

jest.mock('../src/services/realtime/chatSocket', () => ({
  createChatSocket: () => mockSocket,
}));

jest.mock('../src/services/api/client', () => {
  class ApiError extends Error {
    statusCode?: number;
    code: string;
    constructor(text: string, statusCode?: number, code = 'UNKNOWN') {
      super(text);
      this.statusCode = statusCode;
      this.code = code;
    }
  }
  return { ApiError, refreshAccessToken: jest.fn(), apiClient: {} };
});

jest.mock('../src/services/api/chat', () => ({
  chatApi: {
    listConversations: jest.fn(),
    getConversation: jest.fn(),
    openDirect: jest.fn(),
    setMuted: jest.fn(),
    deleteForMe: jest.fn(),
    listMessages: jest.fn(),
    sendMessage: jest.fn(),
    unsend: jest.fn(),
    markRead: jest.fn(),
    editMessage: jest.fn(),
    react: jest.fn(),
    unreact: jest.fn(),
  },
}));

jest.mock('../src/features/media/uploadMedia', () => ({
  uploadMedia: jest.fn(),
  uploadErrorMessage: (err: Error) => err.message,
}));

jest.mock('../src/features/media/localFiles', () => ({
  deleteFile: jest.fn(() => Promise.resolve()),
}));

const { uploadMedia } = jest.requireMock('../src/features/media/uploadMedia') as {
  uploadMedia: jest.Mock;
};
const { deleteFile } = jest.requireMock('../src/features/media/localFiles') as {
  deleteFile: jest.Mock;
};

const { chatApi } = jest.requireMock('../src/services/api/chat') as {
  chatApi: Record<string, jest.Mock>;
};
const { ApiError, refreshAccessToken } = jest.requireMock(
  '../src/services/api/client',
) as { ApiError: any; refreshAccessToken: jest.Mock };

// Imported after the mocks are registered.
const { chat } = require('../src/features/chats/chatController') as typeof import('../src/features/chats/chatController');
const { chatStore } = require('../src/features/chats/chatStore') as typeof import('../src/features/chats/chatStore');

const ME = 'me0000000000000000000000';
const PEER = 'peer00000000000000000000';
const CONVO = 'c00000000000000000000001';

let seq = 0;
const oid = () => (++seq).toString(16).padStart(24, '0');

function message(over: Partial<MessageDto> = {}): MessageDto {
  const id = over.id ?? oid();
  return {
    id,
    conversation_id: CONVO,
    sender_id: PEER,
    type: 'text',
    body: 'hello',
    media: null,
    reply_to_id: null,
    reply_to: null,
    client_message_id: `client-${id}`,
    is_deleted: false,
    created_at: new Date(Date.now() + seq).toISOString(),
    ...over,
  };
}

function conversation(over: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: CONVO,
    type: 'direct',
    peer: {
      id: PEER,
      username: 'peer',
      display_name: 'Peer',
      avatar_url: null,
      last_active_at: null,
    },
    participants: [],
    last_message: null,
    unread_count: 0,
    last_read_message_id: null,
    peer_last_read_message_id: null,
    is_muted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

const page = <T>(data: T[], hasMore = false) => ({
  data,
  pagination: { next_cursor: hasMore ? 'next' : null, has_more: hasMore },
});

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise<void>(r => setImmediate(r));
};
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const fire = (event: string, payload?: unknown) =>
  mockHandlers[event]?.forEach(h => h(payload));
const state = () => chatStore.get();
const thread = () => state().threads[CONVO]!;

async function startWith(convo = conversation(), messages: MessageDto[] = []) {
  chatApi.listConversations.mockResolvedValue(page([convo]));
  chatApi.listMessages.mockResolvedValue(page(messages));
  chatApi.markRead.mockResolvedValue({});
  chat.start(ME);
  await flush();
}

async function openThread(messages: MessageDto[] = []) {
  chatApi.listMessages.mockResolvedValueOnce(page(messages));
  chat.openThread(CONVO);
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSocket.connected = false;
  mockSocket.active = false;
});

afterEach(() => {
  chat.stop();
  jest.useRealTimers();
});

describe('inbox', () => {
  it('loads conversations on start and subscribes to peer presence', async () => {
    await startWith();
    expect(state().inbox.status).toBe('ready');
    expect(state().conversations[CONVO]).toBeDefined();
    const call = mockSocket.emit.mock.calls.find(c => c[0] === 'presence.subscribe');
    expect(call?.[1]).toEqual({ user_ids: [PEER] });
    call?.[2]({ data: [{ user_id: PEER, is_online: true, last_active_at: null }] });
    expect(state().presence[PEER]?.is_online).toBe(true);
  });

  it('shows an error state when the first load fails, keeps data on later failures', async () => {
    chatApi.listConversations.mockRejectedValue(new ApiError('Offline', 0));
    chat.start(ME);
    await flush();
    expect(state().inbox).toMatchObject({ status: 'error', error: 'Offline' });

    chatApi.listConversations.mockResolvedValueOnce(page([conversation()]));
    await chat.refreshInbox();
    chatApi.listConversations.mockRejectedValueOnce(new ApiError('Offline', 0));
    await chat.refreshInbox();
    expect(state().inbox.status).toBe('ready');
    expect(state().conversations[CONVO]).toBeDefined();
  });

  it('fetches a conversation it has never seen when a message arrives', async () => {
    await startWith(conversation({ id: 'other0000000000000000000' }));
    chatApi.getConversation.mockResolvedValue(conversation());
    fire('message.new', message());
    await flush();
    expect(chatApi.getConversation).toHaveBeenCalledWith(CONVO);
    expect(state().conversations[CONVO]).toBeDefined();
  });

  it('applies live conversation and presence updates', async () => {
    await startWith();
    fire('conversation.updated', conversation({ unread_count: 3 }));
    expect(state().conversations[CONVO]?.unread_count).toBe(3);
    fire('presence.update', { user_id: PEER, is_online: false, last_active_at: 'x' });
    expect(state().presence[PEER]).toMatchObject({ is_online: false, last_active_at: 'x' });
  });
});

describe('thread', () => {
  it('adds incoming messages, updates the preview and marks read while viewing', async () => {
    await startWith();
    await openThread([message({ body: 'old' })]);
    fire('conversation.updated', conversation({ unread_count: 1 }));
    expect(state().conversations[CONVO]?.unread_count).toBe(0);

    const incoming = message({ body: 'new one' });
    fire('message.new', incoming);
    expect(thread().messages[0]?.body).toBe('new one');
    expect(state().conversations[CONVO]?.last_message?.body).toBe('new one');
    await wait(350);
    expect(chatApi.markRead).toHaveBeenCalledWith(CONVO);
  });

  it('does not mark read once the thread is closed', async () => {
    await startWith();
    await openThread();
    await wait(350);
    chatApi.markRead.mockClear();
    chat.closeThread(CONVO);
    fire('message.new', message());
    await wait(350);
    expect(chatApi.markRead).not.toHaveBeenCalled();
  });

  it('pages older messages and stops when there are no more', async () => {
    await startWith();
    chatApi.listMessages.mockResolvedValueOnce(page([message({ body: 'newest' })], true));
    chat.openThread(CONVO);
    await flush();
    chatApi.listMessages.mockResolvedValueOnce(page([message({ body: 'older' })], false));
    await chat.loadOlder(CONVO);
    expect(thread().messages.map(m => m.body)).toEqual(
      expect.arrayContaining(['newest', 'older']),
    );
    expect(thread().hasMore).toBe(false);
    chatApi.listMessages.mockClear();
    await chat.loadOlder(CONVO);
    expect(chatApi.listMessages).not.toHaveBeenCalled();
  });

  it('records a load error and recovers on retry', async () => {
    await startWith();
    chatApi.listMessages.mockRejectedValueOnce(new ApiError('Nope', 500));
    chat.openThread(CONVO);
    await flush();
    expect(thread()).toMatchObject({ loaded: false, error: 'Nope' });
    chatApi.listMessages.mockResolvedValueOnce(page([message()]));
    chat.retryThread(CONVO);
    await flush();
    expect(thread()).toMatchObject({ loaded: true, error: null });
  });

  it('catches up on missed messages after a reconnect', async () => {
    await startWith();
    const last = message({ body: 'before drop' });
    await openThread([last]);
    mockSocket.connected = false;
    fire('disconnect', 'transport close');
    expect(state().connected).toBe(false);

    chatApi.listMessages.mockClear();
    chatApi.listMessages.mockResolvedValue(page([message({ body: 'while away' })]));
    mockSocket.connect();
    await flush();
    expect(chatApi.listMessages).toHaveBeenCalledWith(CONVO, { after: last.id, limit: 50 });
    expect(thread().messages[0]?.body).toBe('while away');
  });

  it('moves the "Seen" marker forward only', async () => {
    await startWith();
    fire('message.read', {
      conversation_id: CONVO,
      user_id: PEER,
      last_read_message_id: 'b'.repeat(24),
      read_at: '',
    });
    fire('message.read', {
      conversation_id: CONVO,
      user_id: PEER,
      last_read_message_id: 'a'.repeat(24),
      read_at: '',
    });
    expect(state().conversations[CONVO]?.peer_last_read_message_id).toBe('b'.repeat(24));
    // My own receipts (other devices) don't count as "Seen".
    fire('message.read', {
      conversation_id: CONVO,
      user_id: ME,
      last_read_message_id: 'c'.repeat(24),
      read_at: '',
    });
    expect(state().conversations[CONVO]?.peer_last_read_message_id).toBe('b'.repeat(24));
  });
});

describe('sending', () => {
  it('shows the message instantly and swaps in the server copy', async () => {
    await startWith();
    await openThread();
    let resolve: (m: MessageDto) => void = () => undefined;
    chatApi.sendMessage.mockReturnValue(new Promise(r => (resolve = r)));

    chat.send(CONVO, '  hi there  ');
    expect(thread().messages).toHaveLength(1);
    expect(thread().messages[0]).toMatchObject({ body: 'hi there', status: 'sending' });
    const local = thread().messages[0]!;
    expect(chatApi.sendMessage).toHaveBeenCalledWith(CONVO, {
      body: 'hi there',
      client_message_id: local.client_message_id,
      reply_to_id: undefined,
      gif: undefined,
    });

    resolve(message({ sender_id: ME, body: 'hi there', client_message_id: local.client_message_id }));
    await flush();
    expect(thread().messages).toHaveLength(1);
    expect(thread().messages[0]?.status).toBe('sent');

    // The socket echo of the same message must not duplicate it.
    fire('message.new', { ...thread().messages[0] });
    expect(thread().messages).toHaveLength(1);
  });

  it('ignores blank messages', async () => {
    await startWith();
    await openThread();
    chat.send(CONVO, '   \n ');
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
    expect(thread().messages).toHaveLength(0);
  });

  it('marks failures and retries with the same client id', async () => {
    await startWith();
    await openThread();
    chatApi.sendMessage.mockRejectedValueOnce(new ApiError('Offline', 0));
    chat.send(CONVO, 'flaky');
    await flush();
    const failed = thread().messages[0]!;
    expect(failed.status).toBe('failed');

    chatApi.sendMessage.mockResolvedValueOnce(
      message({ sender_id: ME, body: 'flaky', client_message_id: failed.client_message_id }),
    );
    chat.retry(CONVO, failed.client_message_id);
    await flush();
    expect(chatApi.sendMessage.mock.calls[1][1].client_message_id).toBe(
      failed.client_message_id,
    );
    expect(thread().messages).toHaveLength(1);
    expect(thread().messages[0]?.status).toBe('sent');
  });

  it('sends replies with a quoted preview', async () => {
    await startWith();
    const original = message({ body: 'Dinner at 8?' });
    await openThread([original]);
    chatApi.sendMessage.mockReturnValue(new Promise(() => undefined));
    chat.send(CONVO, 'Yes!', { ...original, status: 'sent' });
    expect(thread().messages[0]?.reply_to).toMatchObject({
      id: original.id,
      body: 'Dinner at 8?',
    });
    expect(chatApi.sendMessage.mock.calls[0][1].reply_to_id).toBe(original.id);
  });

  it('falls back to a plain message when the quoted one was unsent', async () => {
    await startWith();
    const original = message();
    await openThread([original]);
    chatApi.sendMessage
      .mockRejectedValueOnce(new ApiError('Gone', 400, 'REPLY_TARGET_NOT_FOUND'))
      .mockImplementationOnce(async (_id: string, input: { client_message_id: string }) =>
        message({ sender_id: ME, body: 'ok', client_message_id: input.client_message_id }),
      );
    chat.send(CONVO, 'ok', { ...original, status: 'sent' });
    await flush();
    expect(chatApi.sendMessage).toHaveBeenCalledTimes(2);
    expect(chatApi.sendMessage.mock.calls[1][1].reply_to_id).toBeUndefined();
    expect(thread().messages.find(m => m.body === 'ok')).toMatchObject({
      status: 'sent',
      reply_to: null,
    });
  });

  it('sends GIFs with the GIPHY payload', async () => {
    await startWith();
    await openThread();
    chatApi.sendMessage.mockReturnValue(new Promise(() => undefined));
    const gif: GifItem = {
      id: 'g1',
      title: 'wave',
      url: 'https://media1.giphy.com/media/g1/200w.gif',
      preview_url: 'https://media1.giphy.com/media/g1/200w_d.gif',
      width: 200,
      height: 100,
    };
    chat.sendGif(CONVO, gif);
    expect(thread().messages[0]).toMatchObject({ type: 'gif', body: '' });
    expect(chatApi.sendMessage.mock.calls[0][1]).toMatchObject({
      body: undefined,
      gif: {
        kind: 'gif',
        id: 'g1',
        url: gif.url,
        preview_url: gif.preview_url,
        width: 200,
        height: 100,
      },
    });
    expect(state().conversations[CONVO]?.last_message?.type).toBe('gif');
  });

  it('sends stickers as their own type, including retries', async () => {
    await startWith();
    await openThread();
    const sticker: GifItem = {
      id: 's1',
      title: 'heart',
      url: 'https://media0.giphy.com/media/s1/200w.gif',
      preview_url: 'https://media0.giphy.com/media/s1/200w_d.gif',
      width: 200,
      height: 200,
    };
    chatApi.sendMessage.mockRejectedValueOnce(new ApiError('Offline', 0));
    chat.sendGif(CONVO, sticker, null, 'sticker');
    expect(thread().messages[0]).toMatchObject({ type: 'sticker', body: '' });
    expect(chatApi.sendMessage.mock.calls[0][1].gif).toMatchObject({ kind: 'sticker', id: 's1' });
    await flush();
    expect(thread().messages[0]?.status).toBe('failed');

    chatApi.sendMessage.mockImplementationOnce(async (_id: string, input: any) =>
      message({ sender_id: ME, type: 'sticker', client_message_id: input.client_message_id }),
    );
    chat.retry(CONVO, thread().messages[0]!.client_message_id);
    await flush();
    expect(chatApi.sendMessage.mock.calls[1][1].gif).toMatchObject({ kind: 'sticker' });
    expect(thread().messages[0]).toMatchObject({ type: 'sticker', status: 'sent' });
    expect(state().conversations[CONVO]?.last_message?.type).toBe('sticker');
  });
});

describe('sending files', () => {
  const photo = (name: string) => ({
    uri: `content://media/${name}`,
    kind: 'image' as const,
    contentType: 'image/jpeg',
    fileName: `${name}.jpg`,
    bytes: 2048,
    width: 1080,
    height: 1350,
  });
  const voice = {
    uri: 'file:///data/voice.mp4',
    kind: 'audio' as const,
    contentType: 'audio/mp4',
    fileName: 'voice.m4a',
    bytes: 4096,
    durationMs: 3200,
  };
  const echo = (type: MessageDto['type'], url: string) =>
    async (_id: string, input: any) =>
      message({
        sender_id: ME,
        type,
        body: '',
        client_message_id: input.client_message_id,
        media: {
          provider: 'upload',
          provider_id: null,
          media_id: input.media_id,
          url,
          preview_url: null,
          width: 1080,
          height: 1350,
          duration_ms: null,
        },
      });

  const echoAlbum = async (_id: string, input: any) =>
    message({
      sender_id: ME,
      type: 'album',
      body: '',
      client_message_id: input.client_message_id,
      media: null,
      media_items: input.media_ids.map((id: string) => ({
        provider: 'upload',
        provider_id: null,
        media_id: id,
        url: `https://cdn/${id}.jpg`,
        preview_url: null,
        width: 1080,
        height: 1350,
        duration_ms: null,
      })),
    });

  it('sends files picked separately one after another', async () => {
    await startWith();
    await openThread();
    const order: string[] = [];
    uploadMedia.mockImplementation(async (file: { fileName: string }) => {
      order.push(`upload:${file.fileName}`);
      return { id: `media-${file.fileName}`, width: 1080, height: 1350, duration_ms: null };
    });
    chatApi.sendMessage.mockImplementation(async (id: string, input: any) => {
      order.push(`send:${input.media_id}`);
      return echo('image', 'https://cdn/x.jpg')(id, input);
    });

    chat.sendFiles(CONVO, [photo('a')]);
    chat.sendFiles(CONVO, [photo('b')]);
    expect(thread().messages.map(m => m.type)).toEqual(['image', 'image']);
    expect(thread().messages[0]).toMatchObject({ status: 'sending', localUri: 'content://media/b' });
    await flush(15);

    expect(order).toEqual([
      'upload:a.jpg',
      'send:media-a.jpg',
      'upload:b.jpg',
      'send:media-b.jpg',
    ]);
    expect(uploadMedia.mock.calls[0][1]).toBe('message');
    expect(thread().messages.every(m => m.status === 'sent')).toBe(true);
    // The bubble keeps showing the file on the device instead of reloading the remote copy.
    expect(thread().messages.map(m => m.localUri).sort()).toEqual([
      'content://media/a',
      'content://media/b',
    ]);
    expect(state().conversations[CONVO]?.last_message?.type).toBe('image');
  });

  it('sends several photos picked together as one album, in order', async () => {
    await startWith();
    await openThread();
    uploadMedia.mockImplementation(async (file: { fileName: string }) => ({
      id: `media-${file.fileName}`,
      width: 1080,
      height: 1350,
      duration_ms: null,
    }));
    chatApi.sendMessage.mockImplementation(echoAlbum);

    chat.sendFiles(CONVO, [photo('a'), photo('b'), photo('c')]);
    expect(thread().messages).toHaveLength(1);
    expect(thread().messages[0]).toMatchObject({
      type: 'album',
      status: 'sending',
      localUris: ['content://media/a', 'content://media/b', 'content://media/c'],
    });
    await flush(20);

    expect(uploadMedia.mock.calls.map(c => c[0].fileName)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
    expect(chatApi.sendMessage.mock.calls[0][1]).toMatchObject({
      media_ids: ['media-a.jpg', 'media-b.jpg', 'media-c.jpg'],
    });
    expect(chatApi.sendMessage.mock.calls[0][1].media_id).toBeUndefined();
    expect(thread().messages[0]).toMatchObject({
      status: 'sent',
      type: 'album',
      localUris: ['content://media/a', 'content://media/b', 'content://media/c'],
    });
  });

  it('retries an album without uploading the files already stored', async () => {
    await startWith();
    await openThread();
    uploadMedia
      .mockResolvedValueOnce({ id: 'm-a', width: 1, height: 1, duration_ms: null })
      .mockRejectedValueOnce(new Error('Network down'));
    chat.sendFiles(CONVO, [photo('a'), photo('b')]);
    await flush(10);
    expect(thread().messages[0]?.status).toBe('failed');
    expect(chatApi.sendMessage).not.toHaveBeenCalled();

    uploadMedia.mockResolvedValueOnce({ id: 'm-b', width: 1, height: 1, duration_ms: null });
    chatApi.sendMessage.mockImplementationOnce(echoAlbum);
    chat.retry(CONVO, thread().messages[0]!.client_message_id);
    await flush(10);
    expect(uploadMedia).toHaveBeenCalledTimes(3);
    expect(uploadMedia.mock.calls[2][0].fileName).toBe('b.jpg');
    expect(chatApi.sendMessage.mock.calls[0][1].media_ids).toEqual(['m-a', 'm-b']);
    expect(thread().messages[0]?.status).toBe('sent');
  });

  it('replies to one photo of an album with that photo as the quote', async () => {
    await startWith();
    const album = message({
      sender_id: PEER,
      type: 'album',
      body: '',
      media: null,
      media_items: ['p0', 'p1'].map(id => ({
        provider: 'upload' as const,
        provider_id: null,
        media_id: id,
        url: `https://cdn/${id}.jpg`,
        preview_url: null,
        width: 10,
        height: 10,
        duration_ms: null,
      })),
    });
    await openThread([album]);
    chatApi.sendMessage.mockReturnValue(new Promise(() => {}));
    chat.send(CONVO, 'this one', { ...album, status: 'sent' }, 1);
    expect(thread().messages[0]).toMatchObject({
      reply_to_index: 1,
      reply_to: { media: { url: 'https://cdn/p1.jpg', count: 1 } },
    });
    expect(chatApi.sendMessage.mock.calls[0][1]).toMatchObject({
      reply_to_id: album.id,
      reply_to_index: 1,
    });

    chat.send(CONVO, 'all of them', { ...album, status: 'sent' });
    expect(thread().messages[0]?.reply_to?.media).toMatchObject({
      url: 'https://cdn/p0.jpg',
      count: 2,
      next_url: 'https://cdn/p1.jpg',
      stack: [
        { url: 'https://cdn/p0.jpg', kind: 'image' },
        { url: 'https://cdn/p1.jpg', kind: 'image' },
      ],
    });
  });

  it('shows why an upload failed and resumes it on retry', async () => {
    await startWith();
    await openThread();
    uploadMedia.mockRejectedValueOnce(new Error('This file is too large. The limit is 10 MB.'));
    chat.sendFiles(CONVO, [photo('big')]);
    await flush();
    expect(thread().messages[0]).toMatchObject({
      status: 'failed',
      failure: 'This file is too large. The limit is 10 MB.',
    });
    expect(chatApi.sendMessage).not.toHaveBeenCalled();

    const session = thread().messages[0]!.upload!.items[0]!.session;
    uploadMedia.mockResolvedValueOnce({ id: 'media-1', width: 10, height: 10, duration_ms: null });
    chatApi.sendMessage.mockImplementationOnce(echo('image', 'https://cdn/1.jpg'));
    chat.retry(CONVO, thread().messages[0]!.client_message_id);
    expect(thread().messages[0]?.failure).toBeUndefined();
    await flush(10);
    expect(uploadMedia.mock.calls[1][2].session).toBe(session);
    expect(thread().messages[0]).toMatchObject({ status: 'sent', type: 'image' });
  });

  it('does not upload again when only sending the message failed', async () => {
    await startWith();
    await openThread();
    uploadMedia.mockResolvedValueOnce({ id: 'media-7', width: 1, height: 1, duration_ms: null });
    chatApi.sendMessage.mockRejectedValueOnce(new ApiError('Offline', 0));
    chat.sendFiles(CONVO, [photo('a')]);
    await flush(10);
    expect(thread().messages[0]?.status).toBe('failed');

    chatApi.sendMessage.mockImplementationOnce(echo('image', 'https://cdn/7.jpg'));
    chat.retry(CONVO, thread().messages[0]!.client_message_id);
    await flush(10);
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect(chatApi.sendMessage.mock.calls[1][1].media_id).toBe('media-7');
    expect(thread().messages[0]?.status).toBe('sent');
  });

  it('sends a voice note and deletes the recording once it is stored', async () => {
    await startWith();
    await openThread();
    uploadMedia.mockResolvedValueOnce({ id: 'media-v', width: null, height: null, duration_ms: 3200 });
    chatApi.sendMessage.mockImplementationOnce(echo('voice', 'https://cdn/v.m4a'));
    chat.sendFiles(CONVO, [voice]);
    expect(thread().messages[0]).toMatchObject({
      type: 'voice',
      media: { provider: 'upload', duration_ms: 3200 },
    });
    await flush(10);
    expect(thread().messages[0]).toMatchObject({ status: 'sent', type: 'voice' });
    expect(thread().messages[0]?.localUri).toBeUndefined();
    expect(deleteFile).toHaveBeenCalledWith('file:///data/voice.mp4');
  });
});

describe('unsend', () => {
  it('hides the message, its quotes and the preview immediately', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'oops' });
    const quote = message({
      reply_to_id: mine.id,
      reply_to: { id: mine.id, sender_id: ME, type: 'text', body: 'oops', is_deleted: false },
    });
    await openThread([mine, quote]);
    fire('message.new', { ...mine });
    chatApi.unsend.mockResolvedValue({});
    // Make the unsent message the last one in the inbox.
    fire('conversation.updated', conversation({ last_message: { ...mine } }));

    await chat.unsend(CONVO, mine.id);
    const byId = (id: string) => thread().messages.find(m => m.id === id)!;
    expect(byId(mine.id)).toMatchObject({ is_deleted: true, body: '' });
    expect(byId(quote.id).reply_to).toMatchObject({ is_deleted: true, body: '' });
    expect(state().conversations[CONVO]?.last_message).toMatchObject({
      id: quote.id,
      is_deleted: false,
    });
  });

  it('clears the preview when nothing visible is left', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'only one' });
    await openThread([mine]);
    fire('conversation.updated', conversation({ last_message: { ...mine } }));
    chatApi.unsend.mockResolvedValue({});
    await chat.unsend(CONVO, mine.id);
    expect(state().conversations[CONVO]?.last_message).toBeNull();
  });

  it('previews the previous message after unsending the last one', async () => {
    await startWith();
    const earlier = message({ body: 'see you at 8' });
    const mine = message({ sender_id: ME, body: 'oops' });
    await openThread([mine, earlier]);
    fire('conversation.updated', conversation({ last_message: { ...mine } }));
    chatApi.unsend.mockResolvedValue({});

    await chat.unsend(CONVO, mine.id);
    expect(state().conversations[CONVO]?.last_message).toMatchObject({
      id: earlier.id,
      body: 'see you at 8',
      is_deleted: false,
    });
  });

  it('restores everything when the server refuses', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'keep me' });
    await openThread([mine]);
    fire('conversation.updated', conversation({ last_message: { ...mine } }));
    chatApi.unsend.mockRejectedValue(new ApiError('No', 500));

    await expect(chat.unsend(CONVO, mine.id)).rejects.toBeTruthy();
    expect(thread().messages[0]).toMatchObject({ is_deleted: false, body: 'keep me' });
    expect(state().conversations[CONVO]?.last_message).toMatchObject({ body: 'keep me' });
  });

  it('ignores messages that are not delivered yet', async () => {
    await startWith();
    await openThread();
    chatApi.sendMessage.mockReturnValue(new Promise(() => undefined));
    chat.send(CONVO, 'pending');
    await chat.unsend(CONVO, thread().messages[0]!.id);
    expect(chatApi.unsend).not.toHaveBeenCalled();
  });

  it('applies unsends from the other person in real time', async () => {
    await startWith();
    const theirs = message({ body: 'regret' });
    await openThread([theirs]);
    fire('message.deleted', { conversation_id: CONVO, message_id: theirs.id });
    expect(thread().messages[0]).toMatchObject({ is_deleted: true, body: '', media: null });
  });
});

describe('reactions', () => {
  const byId = (id: string) => thread().messages.find(m => m.id === id)!;

  it('adds my reaction optimistically and keeps the server grouping', async () => {
    await startWith();
    const theirs = message();
    await openThread([theirs]);
    let resolve!: (v: unknown) => void;
    chatApi.react.mockReturnValue(new Promise(r => (resolve = r)));

    const pending = chat.react(CONVO, theirs.id, '😂');
    expect(byId(theirs.id).reactions).toEqual([
      { emoji: '😂', user_ids: [ME], count: 1 },
    ]);
    const server = [{ emoji: '😂', user_ids: [PEER, ME], count: 2 }];
    resolve({ conversation_id: CONVO, message_id: theirs.id, reactions: server });
    await pending;
    expect(chatApi.react).toHaveBeenCalledWith(CONVO, theirs.id, '😂');
    expect(byId(theirs.id).reactions).toEqual(server);
  });

  it('tapping the same emoji removes it, another one replaces it', async () => {
    await startWith();
    const theirs = message({
      reactions: [{ emoji: '❤️', user_ids: [ME], count: 1 }],
    });
    await openThread([theirs]);
    chatApi.unreact.mockResolvedValue({ conversation_id: CONVO, message_id: theirs.id, reactions: [] });
    await chat.react(CONVO, theirs.id, '❤️');
    expect(chatApi.unreact).toHaveBeenCalledWith(CONVO, theirs.id);
    expect(byId(theirs.id).reactions).toEqual([]);

    const replaced = [{ emoji: '👍', user_ids: [ME], count: 1 }];
    chatApi.react.mockResolvedValue({ conversation_id: CONVO, message_id: theirs.id, reactions: replaced });
    await chat.react(CONVO, theirs.id, '👍');
    expect(byId(theirs.id).reactions).toEqual(replaced);
  });

  it('rolls back when the server refuses', async () => {
    await startWith();
    const before = [{ emoji: '😮', user_ids: [PEER], count: 1 }];
    const theirs = message({ reactions: before });
    await openThread([theirs]);
    chatApi.react.mockRejectedValue(new ApiError('No', 500));
    await expect(chat.react(CONVO, theirs.id, '😮')).rejects.toBeTruthy();
    expect(byId(theirs.id).reactions).toEqual(before);
  });

  it('ignores messages that are not delivered yet', async () => {
    await startWith();
    await openThread();
    chatApi.sendMessage.mockReturnValue(new Promise(() => undefined));
    chat.send(CONVO, 'pending');
    await chat.react(CONVO, thread().messages[0]!.id, '❤️');
    expect(chatApi.react).not.toHaveBeenCalled();
  });

  it('applies reactions from the other person in real time', async () => {
    await startWith();
    const mine = message({ sender_id: ME });
    await openThread([mine]);
    const reactions = [{ emoji: '🔥', user_ids: [PEER], count: 1 }];
    fire('message.reaction', { conversation_id: CONVO, message_id: mine.id, reactions });
    expect(byId(mine.id).reactions).toEqual(reactions);
  });
});

describe('edit', () => {
  const byId = (id: string) => thread().messages.find(m => m.id === id)!;

  it('updates the message, its quotes and the preview right away', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'helo' });
    const quote = message({
      reply_to_id: mine.id,
      reply_to: { id: mine.id, sender_id: ME, type: 'text', body: 'helo', is_deleted: false },
    });
    await openThread([quote, mine]);
    fire('conversation.updated', conversation({ last_message: { ...mine } }));
    chatApi.editMessage.mockResolvedValue({ ...mine, body: 'hello', edited_at: new Date().toISOString() });

    await chat.edit(CONVO, mine.id, '  hello ');
    expect(chatApi.editMessage).toHaveBeenCalledWith(CONVO, mine.id, 'hello');
    expect(byId(mine.id)).toMatchObject({ body: 'hello' });
    expect(byId(mine.id).edited_at).toBeTruthy();
    expect(byId(quote.id).reply_to).toMatchObject({ body: 'hello', is_edited: true });
    expect(state().conversations[CONVO]?.last_message).toMatchObject({ body: 'hello' });
  });

  it('restores the old text when the server refuses', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'original' });
    await openThread([mine]);
    fire('conversation.updated', conversation({ last_message: { ...mine } }));
    chatApi.editMessage.mockRejectedValue(new ApiError('Too late', 400, 'EDIT_WINDOW_EXPIRED'));

    await expect(chat.edit(CONVO, mine.id, 'changed')).rejects.toBeTruthy();
    expect(byId(mine.id)).toMatchObject({ body: 'original', edited_at: null });
    expect(state().conversations[CONVO]?.last_message).toMatchObject({ body: 'original' });
  });

  it('skips blank or unchanged text', async () => {
    await startWith();
    const mine = message({ sender_id: ME, body: 'same' });
    await openThread([mine]);
    await chat.edit(CONVO, mine.id, '   ');
    await chat.edit(CONVO, mine.id, 'same');
    expect(chatApi.editMessage).not.toHaveBeenCalled();
  });

  it('applies edits from the other person in real time', async () => {
    await startWith();
    const theirs = message({ body: 'typo' });
    const myQuote = message({
      sender_id: ME,
      reply_to_id: theirs.id,
      reply_to: { id: theirs.id, sender_id: PEER, type: 'text', body: 'typo', is_deleted: false },
    });
    await openThread([myQuote, theirs]);
    fire('message.updated', { ...theirs, body: 'fixed', edited_at: new Date().toISOString() });
    expect(byId(theirs.id).body).toBe('fixed');
    expect(byId(myQuote.id).reply_to).toMatchObject({ body: 'fixed', is_edited: true });
  });
});

describe('ensureLoaded', () => {
  it('pages back until the quoted message is loaded', async () => {
    await startWith();
    const recent = message();
    await openThread([recent]);
    // openThread loaded one page with has_more false by default; pretend there is more.
    chatStore.set(s => ({
      ...s,
      threads: { ...s.threads, [CONVO]: { ...s.threads[CONVO]!, hasMore: true, nextCursor: 'next' } },
    }));
    const old = message({ body: 'way back' });
    chatApi.listMessages.mockResolvedValueOnce(page([old]));
    await expect(chat.ensureLoaded(CONVO, old.id)).resolves.toBe(true);
    expect(thread().messages.some(m => m.id === old.id)).toBe(true);
  });

  it('gives up when the history ends without it', async () => {
    await startWith();
    await openThread([message()]);
    await expect(chat.ensureLoaded(CONVO, 'f'.repeat(24))).resolves.toBe(false);
  });
});

describe('mute and delete', () => {
  it('mutes optimistically and rolls back on failure', async () => {
    await startWith();
    chatApi.setMuted.mockResolvedValueOnce(conversation({ is_muted: true }));
    await chat.setMuted(CONVO, true);
    expect(state().conversations[CONVO]?.is_muted).toBe(true);

    chatApi.setMuted.mockRejectedValueOnce(new ApiError('No', 500));
    await expect(chat.setMuted(CONVO, false)).rejects.toBeTruthy();
    expect(state().conversations[CONVO]?.is_muted).toBe(true);
  });

  it('deletes a chat locally and restores it if the request fails', async () => {
    await startWith();
    chatApi.deleteForMe.mockRejectedValueOnce(new ApiError('No', 500));
    await expect(chat.deleteForMe(CONVO)).rejects.toBeTruthy();
    expect(state().conversations[CONVO]).toBeDefined();

    chatApi.deleteForMe.mockResolvedValueOnce(undefined);
    await chat.deleteForMe(CONVO);
    expect(state().conversations[CONVO]).toBeUndefined();
  });

  it('removes chats deleted on another device unless they are open here', async () => {
    await startWith();
    await openThread();
    fire('conversation.deleted', { conversation_id: CONVO });
    expect(state().conversations[CONVO]).toBeDefined();
    chat.closeThread(CONVO);
    fire('conversation.deleted', { conversation_id: CONVO });
    expect(state().conversations[CONVO]).toBeUndefined();
  });
});

describe('typing', () => {
  it('shows the indicator, expires it, and clears it when their message lands', async () => {
    await startWith();
    jest.useFakeTimers();
    fire('typing.start', { conversation_id: CONVO, user_id: PEER });
    expect(state().typing[CONVO]).toBe(true);
    jest.advanceTimersByTime(6100);
    expect(state().typing[CONVO]).toBeUndefined();

    fire('typing.start', { conversation_id: CONVO, user_id: PEER });
    fire('message.new', message());
    expect(state().typing[CONVO]).toBeUndefined();

    fire('typing.start', { conversation_id: CONVO, user_id: ME });
    expect(state().typing[CONVO]).toBeUndefined();
  });

  it('throttles my typing events and sends stop', async () => {
    await startWith();
    jest.useFakeTimers();
    mockSocket.emit.mockClear();
    chat.notifyTyping(CONVO);
    chat.notifyTyping(CONVO);
    chat.notifyTyping(CONVO);
    const starts = () => mockSocket.emit.mock.calls.filter(c => c[0] === 'typing.start');
    expect(starts()).toHaveLength(1);
    jest.advanceTimersByTime(3100);
    chat.notifyTyping(CONVO);
    expect(starts()).toHaveLength(2);
    jest.advanceTimersByTime(4100);
    expect(mockSocket.emit).toHaveBeenCalledWith('typing.stop', { conversation_id: CONVO });
  });
});

describe('connection', () => {
  it('refreshes the token on an auth error and reconnects', async () => {
    await startWith();
    mockSocket.connect.mockClear();
    refreshAccessToken.mockResolvedValueOnce('new');
    const err = Object.assign(new Error('expired'), { data: { code: 'TOKEN_EXPIRED' } });
    fire('connect_error', err);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('does not refresh for disabled accounts', async () => {
    await startWith();
    fire(
      'connect_error',
      Object.assign(new Error('x'), { data: { code: 'ACCOUNT_DISABLED' } }),
    );
    await flush();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('stop clears all state and disconnects', async () => {
    await startWith();
    chat.stop();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(state()).toMatchObject({ meId: null, conversations: {}, threads: {} });
  });
});
