import { apiClient } from './client';
import type { PlanId, SecretUsage } from './subscriptions';

export interface SecretUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

/** "This person was near you today / yesterday." `locked`: the plan doesn't include it. */
export interface NearbyHint {
  state: 'today' | 'yesterday' | 'locked';
  valid_until: string | null;
}

/** Received and sealed: no sender, no text, the day only. */
export interface ReceivedSealedThread {
  id: string;
  role: 'received';
  status: 'sealed';
  replies_used: number;
  has_unread: boolean;
  /** `YYYY-MM-DD` in the viewer's time zone. */
  day: string;
  sender: null;
  conversation_id: null;
  revealed_at: null;
  nearby_hint: NearbyHint | null;
}

export interface ReceivedRevealedThread {
  id: string;
  role: 'received';
  status: 'revealed';
  replies_used: 2;
  has_unread: false;
  day: string;
  sender: SecretUser | null;
  conversation_id: string | null;
  revealed_at: string | null;
  nearby_hint: NearbyHint | null;
}

export interface SentThread {
  id: string;
  role: 'sent';
  status: 'sealed' | 'revealed';
  recipient: SecretUser | null;
  replies_received: number;
  followups_left: number;
  has_unread: boolean;
  day: string;
  created_at: string;
  conversation_id: string | null;
  revealed_at: string | null;
  nearby_hint: NearbyHint | null;
}

export type ReceivedThread = ReceivedSealedThread | ReceivedRevealedThread;
export type SecretThread = ReceivedThread | SentThread;

export type SecretMessage =
  | { id: string; from: 'them'; sealed: true; day: string }
  | {
      id: string;
      from: 'me' | 'them';
      sealed: false;
      body: string;
      created_at: string;
    };

export interface SecretSummary {
  sealed_count: number;
  unread_count: number;
  received_count: number;
  sent_open_count: number;
  sent_count: number;
  can_read: boolean;
  can_send: boolean;
  plan: PlanId;
  usage: SecretUsage;
  locked_items: { id: string; day: string }[];
}

export interface Page<T> {
  data: T[];
  pagination: { next_cursor: string | null; has_more: boolean };
}

export type SendResult =
  | { message: SecretMessage; thread: SecretThread }
  | {
      message: SecretMessage;
      sender: SecretUser | null;
      revealed_messages: SecretMessage[];
      thread: {
        id: string;
        status: 'revealed' | 'sealed';
        conversation_id: string | null;
      };
    };

export const isReveal = (
  r: SendResult,
): r is Extract<SendResult, { revealed_messages: SecretMessage[] }> =>
  'revealed_messages' in r;

export const SECRET_REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'nudity', label: 'Sexual content' },
  { id: 'spam', label: 'Spam' },
  { id: 'self_harm', label: 'Self-harm' },
  { id: 'other', label: 'Something else' },
] as const;
export type SecretReportReason = (typeof SECRET_REPORT_REASONS)[number]['id'];

export const secretMessagesApi = {
  async summary() {
    const { data } = await apiClient.get<SecretSummary>(
      '/secret-messages/summary',
    );
    return data;
  },
  async inbox(cursor?: string | null) {
    const { data } = await apiClient.get<Page<ReceivedThread>>(
      '/secret-messages/inbox',
      { params: { limit: 50, ...(cursor ? { cursor } : {}) } },
    );
    return data;
  },
  async sent(cursor?: string | null) {
    const { data } = await apiClient.get<Page<SentThread>>(
      '/secret-messages/sent',
      { params: { limit: 50, ...(cursor ? { cursor } : {}) } },
    );
    return data;
  },
  async start(body: {
    recipient_id: string;
    body: string;
    client_message_id: string;
  }) {
    const { data } = await apiClient.post<SentThread & { usage: SecretUsage }>(
      '/secret-messages',
      body,
    );
    return data;
  },
  async thread(threadId: string) {
    const { data } = await apiClient.get<SecretThread>(
      `/secret-messages/${threadId}`,
    );
    return data;
  },
  async messages(threadId: string) {
    const { data } = await apiClient.get<Page<SecretMessage>>(
      `/secret-messages/${threadId}/messages`,
    );
    return data;
  },
  async send(threadId: string, body: string, clientMessageId: string) {
    const { data } = await apiClient.post<SendResult>(
      `/secret-messages/${threadId}/messages`,
      { body, client_message_id: clientMessageId },
    );
    return data;
  },
  async markRead(threadId: string) {
    await apiClient.post(`/secret-messages/${threadId}/read`);
  },
  async report(threadId: string, reason: SecretReportReason, details = '') {
    await apiClient.post(`/secret-messages/${threadId}/report`, {
      reason,
      details,
    });
  },
  async blockSender(threadId: string) {
    await apiClient.post(`/secret-messages/${threadId}/block-sender`);
  },
  async remove(threadId: string) {
    await apiClient.delete(`/secret-messages/${threadId}`);
  },
  async blocks() {
    const { data } = await apiClient.get<{ data: { id: string; day: string }[] }>(
      '/users/me/secret-blocks',
    );
    return data.data;
  },
  async unblock(blockId: string) {
    await apiClient.delete(`/users/me/secret-blocks/${blockId}`);
  },
};
