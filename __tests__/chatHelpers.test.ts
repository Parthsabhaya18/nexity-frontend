import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import {
  isHorizontalSwipe,
  MAX_SWIPE_DISTANCE,
  messageSnippet,
  REPLY_THRESHOLD,
  swipeDistance,
} from '../src/components/chat/MessageBubble';
import {
  type ChatMessage,
  chatStore,
  isAtOrAfter,
  mergeMessages,
  presenceOf,
} from '../src/features/chats/chatStore';
import {
  inboxSubtitle,
  previewText,
  useChats,
} from '../src/features/chats/useChats';
import type { ConversationDto } from '../src/services/api/chat';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const last = (over: Partial<NonNullable<ConversationDto['last_message']>> = {}) => ({
  id: 'm'.repeat(24),
  sender_id: 'peer',
  type: 'text' as const,
  body: 'hey',
  is_deleted: false,
  created_at: '2026-10-04T10:00:00.000Z',
  ...over,
});

describe('previewText', () => {
  it.each([
    [{}, false, 'hey'],
    [{}, true, 'You: hey'],
    [{ type: 'gif' as const, body: '' }, false, 'Sent a GIF'],
    [{ type: 'gif' as const, body: '' }, true, 'You: Sent a GIF'],
    [{ type: 'sticker' as const, body: '' }, false, 'Sent a sticker'],
    [{ type: 'sticker' as const, body: '' }, true, 'You: Sent a sticker'],
    [{ type: 'image' as const, body: '' }, false, 'Sent a photo'],
    [{ type: 'voice' as const, body: '' }, false, 'Sent a voice message'],
    [{ is_deleted: true }, false, 'Unsent a message'],
    [{ is_deleted: true }, true, 'You unsent a message'],
  ])('%j (mine: %s) -> %s', (over, mine, expected) => {
    expect(previewText(last(over), mine)).toBe(expected);
  });
});

describe('inboxSubtitle', () => {
  const row = (unread: number, online = false, lastMessage: string | null = 'hey') => ({
    unread,
    online,
    lastMessage,
  });

  it.each([
    [row(1), 'hey', true],
    [row(1, true), 'hey', true],
    [row(2), '2 new messages', true],
    [row(5), '5 new messages', true],
    [row(6), '5+ new messages', true],
    [row(120, true), '5+ new messages', true],
    [row(0), 'hey', true],
    [row(0, false, 'You: see you'), 'You: see you', true],
    [row(0, true), 'Active now', false],
    [row(0, false, null), 'Say hi 👋', false],
  ])('%j -> %s', (chat, text, showTime) => {
    expect(inboxSubtitle(chat)).toEqual({ text, showTime });
  });
});

describe('messageSnippet', () => {
  it.each([
    [{ type: 'text' as const, body: 'Dinner?', is_deleted: false }, 'Dinner?'],
    [{ type: 'gif' as const, body: '', is_deleted: false }, 'GIF'],
    [{ type: 'sticker' as const, body: '', is_deleted: false }, 'Sticker'],
    [{ type: 'image' as const, body: '', is_deleted: false }, 'Photo'],
    [{ type: 'voice' as const, body: '', is_deleted: false }, 'Voice message'],
    [{ type: 'text' as const, body: 'secret', is_deleted: true }, 'Message unsent'],
  ])('%j -> %s', (m, expected) => {
    expect(messageSnippet(m)).toBe(expected);
  });
});

describe('isHorizontalSwipe', () => {
  it.each([
    [12, 2, true],
    [-12, 3, true],
    [30, 19, true],
    [8, 0, false],
    [12, 10, false],
    [3, 40, false],
  ])('dx %d, dy %d -> %s', (dx, dy, expected) => {
    expect(isHorizontalSwipe(dx, dy)).toBe(expected);
  });
});

describe('swipeDistance', () => {
  it('follows the finger 1:1 at first', () => {
    expect(swipeDistance(0)).toBe(0);
    expect(swipeDistance(-20)).toBe(0);
    expect(swipeDistance(30)).toBe(30);
  });

  it('adds resistance, reaches the reply threshold and never passes the maximum', () => {
    const values = [50, 60, 70, 90, 150, 400, 5000].map(swipeDistance);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
    expect(swipeDistance(60)).toBeLessThan(60);
    expect(swipeDistance(120)).toBeGreaterThanOrEqual(REPLY_THRESHOLD);
    expect(Math.max(...values)).toBeLessThanOrEqual(MAX_SWIPE_DISTANCE);
  });
});

describe('presenceOf', () => {
  const user = {
    id: 'u1',
    username: 'u1',
    display_name: 'U1',
    avatar_url: null,
    is_online: false,
    last_active_at: '2026-10-04T09:00:00.000Z',
  };

  it('handles a missing user', () => {
    expect(presenceOf(null, {})).toEqual({ online: false, lastActiveAt: null });
  });

  it('falls back to the snapshot on the user', () => {
    expect(presenceOf(user, {})).toEqual({
      online: false,
      lastActiveAt: user.last_active_at,
    });
  });

  it('prefers live presence over the snapshot', () => {
    expect(
      presenceOf(user, {
        u1: { user_id: 'u1', is_online: true, last_active_at: null },
      }),
    ).toEqual({ online: true, lastActiveAt: user.last_active_at });
  });
});

describe('isAtOrAfter', () => {
  it('compares ObjectIds by time order', () => {
    expect(isAtOrAfter('6700000000000000000000b0', '6700000000000000000000a0')).toBe(true);
    expect(isAtOrAfter('6700000000000000000000a0', '6700000000000000000000a0')).toBe(true);
    expect(isAtOrAfter('6700000000000000000000a0', '6700000000000000000000b0')).toBe(false);
  });
});

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'a'.repeat(24),
  conversation_id: 'c'.repeat(24),
  sender_id: 'me',
  type: 'text',
  body: 'hi',
  media: null,
  reply_to_id: null,
  reply_to: null,
  client_message_id: 'client-1',
  is_deleted: false,
  created_at: '2026-10-04T10:00:00.000Z',
  status: 'sent',
  ...over,
});

describe('mergeMessages (more cases)', () => {
  it('keeps messages from different senders that reuse a client id', () => {
    const mine = msg({ id: '6700000000000000000000a1', sender_id: 'me' });
    const theirs = msg({ id: '6700000000000000000000a2', sender_id: 'peer' });
    expect(mergeMessages([mine], [theirs])).toHaveLength(2);
  });

  it('applies unsends to delivered messages', () => {
    const saved = msg({ id: '6700000000000000000000a1' });
    const merged = mergeMessages([saved], [{ ...saved, is_deleted: true, body: '' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ is_deleted: true, body: '' });
  });

  it('is idempotent for duplicate deliveries', () => {
    const a = msg({ id: '6700000000000000000000a1', client_message_id: 'x' });
    expect(mergeMessages(mergeMessages([], [a]), [a, a])).toHaveLength(1);
  });

  it('breaks timestamp ties by id, newest first', () => {
    const a = msg({ id: '6700000000000000000000a1', client_message_id: 'a' });
    const b = msg({ id: '6700000000000000000000a2', client_message_id: 'b' });
    expect(mergeMessages([a], [b]).map(m => m.id)).toEqual([b.id, a.id]);
  });

  it('lets a failed bubble be retried back to sending', () => {
    const failed = msg({ id: 'local:x', client_message_id: 'x', status: 'failed' });
    const merged = mergeMessages([failed], [{ ...failed, status: 'sending' }]);
    expect(merged[0]?.status).toBe('sending');
  });

  it('does not mutate its inputs', () => {
    const current = [msg({ id: '6700000000000000000000a1', client_message_id: 'a' })];
    const copy = [...current];
    mergeMessages(current, [msg({ id: '6700000000000000000000a2', client_message_id: 'b' })]);
    expect(current).toEqual(copy);
  });
});

describe('useChats', () => {
  const convo = (over: Partial<ConversationDto>): ConversationDto => ({
    id: 'c1',
    type: 'direct',
    peer: {
      id: 'peer',
      username: 'peer',
      display_name: 'Peer',
      avatar_url: null,
      is_online: false,
      last_active_at: null,
    },
    participants: [],
    last_message: last(),
    unread_count: 0,
    last_read_message_id: null,
    peer_last_read_message_id: null,
    is_muted: false,
    created_at: '2026-10-04T09:00:00.000Z',
    updated_at: '2026-10-04T09:00:00.000Z',
    ...over,
  });

  let result: ReturnType<typeof useChats>;
  function Probe() {
    result = useChats();
    return null;
  }

  afterEach(() => act(() => chatStore.reset(null)));

  it('builds the inbox: sorted, previews, muted chats excluded from the badge', () => {
    act(() => {
      chatStore.reset('me');
      chatStore.set(s => ({
        ...s,
        conversations: {
          old: convo({ id: 'old', unread_count: 2 }),
          muted: convo({
            id: 'muted',
            unread_count: 5,
            is_muted: true,
            last_message: last({ created_at: '2026-10-04T11:00:00.000Z' }),
          }),
          mine: convo({
            id: 'mine',
            last_message: last({
              sender_id: 'me',
              body: 'see you',
              created_at: '2026-10-04T12:00:00.000Z',
            }),
          }),
          empty: convo({ id: 'empty', last_message: null }),
        },
        presence: { peer: { user_id: 'peer', is_online: true, last_active_at: null } },
      }));
    });

    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(createElement(Probe));
    });

    expect(result.chats.map(c => c.id)).toEqual(['mine', 'muted', 'old']);
    expect(result.chats[0]?.lastMessage).toBe('You: see you');
    expect(result.chats.every(c => c.online)).toBe(true);
    expect(result.unreadCount).toBe(1);

    act(() => {
      chatStore.set(s => ({
        ...s,
        conversations: { ...s.conversations, old: convo({ id: 'old', unread_count: 0 }) },
      }));
    });
    expect(result.unreadCount).toBe(0);
    act(() => renderer?.unmount());
  });
});
