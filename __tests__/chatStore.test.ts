import { type ChatMessage, mergeMessages } from '../src/features/chats/chatStore';

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

describe('mergeMessages', () => {
  it('replaces the optimistic bubble with the server copy', () => {
    const local = msg({ id: 'local:client-1', status: 'sending' });
    const saved = msg({ id: '6700000000000000000000aa' });
    const merged = mergeMessages([local], [saved]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: saved.id, status: 'sent' });
  });

  it('does not downgrade a delivered message when a late failure arrives', () => {
    const saved = msg({ id: '6700000000000000000000aa' });
    const merged = mergeMessages([saved], [{ ...saved, status: 'failed' }]);
    expect(merged[0]?.status).toBe('sent');
  });

  it('orders newest first and keeps unsent bubbles at the newest end', () => {
    const older = msg({
      id: '6700000000000000000000a1',
      client_message_id: 'c1',
      created_at: '2026-10-04T10:00:00.000Z',
    });
    const newer = msg({
      id: '6700000000000000000000a2',
      client_message_id: 'c2',
      sender_id: 'peer',
      created_at: '2026-10-04T10:05:00.000Z',
    });
    const pending = msg({
      id: 'local:c3',
      client_message_id: 'c3',
      status: 'sending',
      created_at: '2026-10-04T10:01:00.000Z',
    });
    const merged = mergeMessages([older], [pending, newer]);
    expect(merged.map(m => m.client_message_id)).toEqual(['c3', 'c2', 'c1']);
  });
});
