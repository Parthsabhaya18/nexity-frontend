import { apiClient } from './client';

export interface ChatUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
  is_online?: boolean;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'gif'
  | 'sticker'
  | 'voice'
  | 'system';

export interface MessageMedia {
  provider: 'giphy' | 'upload';
  provider_id: string | null;
  media_id: string | null;
  url: string;
  preview_url: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface ReplyPreview {
  id: string;
  sender_id: string;
  type: MessageType;
  body: string;
  is_deleted: boolean;
  is_edited?: boolean;
}

/** Reactions grouped by emoji; each person has at most one reaction per message. */
export interface ReactionGroup {
  emoji: string;
  user_ids: string[];
  count: number;
}

export interface ReactionUpdate {
  conversation_id: string;
  message_id: string;
  reactions: ReactionGroup[];
}

export interface MessageDto {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  body: string;
  media: MessageMedia | null;
  reply_to_id: string | null;
  reply_to: ReplyPreview | null;
  client_message_id: string;
  reactions?: ReactionGroup[];
  edited_at?: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface ConversationDto {
  id: string;
  type: 'direct' | 'group';
  peer: ChatUser | null;
  participants: ChatUser[];
  last_message:
    | (Pick<MessageDto, 'id' | 'sender_id' | 'type' | 'body' | 'created_at'> & {
        is_deleted?: boolean;
      })
    | null;
  unread_count: number;
  last_read_message_id: string | null;
  peer_last_read_message_id: string | null;
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  data: T[];
  pagination: { next_cursor: string | null; has_more: boolean };
}

export interface ReadReceipt {
  conversation_id: string;
  user_id: string;
  last_read_message_id: string;
  read_at: string;
}

export interface PresenceStatus {
  user_id: string;
  is_online: boolean;
  last_active_at: string | null;
}

export interface GifItem {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
}

export interface SendMessageInput {
  client_message_id: string;
  body?: string;
  reply_to_id?: string;
  gif?: Pick<GifItem, 'id' | 'url' | 'width' | 'height'> & {
    preview_url: string | null;
    kind: GifKind;
  };
}

export type GifKind = 'gif' | 'sticker';

export const chatApi = {
  async listConversations(cursor?: string) {
    const { data } = await apiClient.get<Page<ConversationDto>>(
      '/conversations',
      { params: { cursor, limit: 30 } },
    );
    return data;
  },

  async getConversation(id: string) {
    const { data } = await apiClient.get<ConversationDto>(
      `/conversations/${id}`,
    );
    return data;
  },

  /** Returns the existing direct conversation with this person, or creates it. */
  async openDirect(userId: string) {
    const { data } = await apiClient.post<ConversationDto>('/conversations', {
      type: 'direct',
      participant_ids: [userId],
    });
    return data;
  },

  async setMuted(conversationId: string, muted: boolean) {
    const { data } = await apiClient.post<ConversationDto>(
      `/conversations/${conversationId}/mute`,
      { muted },
    );
    return data;
  },

  /** Hides the chat and its history for me only. */
  async deleteForMe(conversationId: string) {
    await apiClient.delete(`/conversations/${conversationId}`);
  },

  /** `cursor` pages older messages (newest first); `after` catches up after a reconnect (oldest first). */
  async listMessages(
    conversationId: string,
    params: { cursor?: string; after?: string; limit?: number } = {},
  ) {
    const { data } = await apiClient.get<Page<MessageDto>>(
      `/conversations/${conversationId}/messages`,
      { params: { limit: 30, ...params } },
    );
    return data;
  },

  async sendMessage(conversationId: string, input: SendMessageInput) {
    const { data } = await apiClient.post<MessageDto>(
      `/conversations/${conversationId}/messages`,
      input,
    );
    return data;
  },

  async unsend(conversationId: string, messageId: string) {
    const { data } = await apiClient.delete<MessageDto>(
      `/conversations/${conversationId}/messages/${messageId}`,
    );
    return data;
  },

  async editMessage(conversationId: string, messageId: string, body: string) {
    const { data } = await apiClient.patch<MessageDto>(
      `/conversations/${conversationId}/messages/${messageId}`,
      { body },
    );
    return data;
  },

  async react(conversationId: string, messageId: string, emoji: string) {
    const { data } = await apiClient.put<ReactionUpdate>(
      `/conversations/${conversationId}/messages/${messageId}/reaction`,
      { emoji },
    );
    return data;
  },

  async unreact(conversationId: string, messageId: string) {
    const { data } = await apiClient.delete<ReactionUpdate>(
      `/conversations/${conversationId}/messages/${messageId}/reaction`,
    );
    return data;
  },

  async markRead(conversationId: string, messageId?: string) {
    const { data } = await apiClient.post<{
      conversation_id: string;
      last_read_message_id: string | null;
      unread_count: number;
    }>(`/conversations/${conversationId}/read`, { message_id: messageId });
    return data;
  },

  async searchUsers(q: string) {
    const { data } = await apiClient.get<{ data: ChatUser[] }>(
      '/users/search',
      { params: { q, limit: 30 } },
    );
    return data.data;
  },

  /** Empty `q` returns trending. `cursor` is the offset string from the previous page. */
  async gifs(q: string, cursor?: string | null, kind: GifKind = 'gif') {
    const { data } = await apiClient.get<Page<GifItem>>(
      q ? '/gifs/search' : '/gifs/trending',
      {
        params: {
          q: q || undefined,
          cursor: cursor ?? undefined,
          limit: kind === 'sticker' ? 30 : 24,
          type: kind,
        },
      },
    );
    return data;
  },
};
