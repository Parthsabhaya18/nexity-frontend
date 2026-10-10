import { apiClient } from './client';

export interface ActivityActor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ActivityItem {
  id: string;
  type:
    | 'comment_post'
    | 'comment_reel'
    | 'secret_message_received'
    | 'secret_message_followup'
    | 'secret_message_reply'
    | 'secret_message_revealed'
    | 'nearby_encounter'
    | 'crush_added'
    | 'crush_match';
  text: string;
  post_id: string | null;
  reel_id: string | null;
  secret_thread_id?: string | null;
  crush_match_id?: string | null;
  conversation_id?: string | null;
  /** The actor is hidden on purpose (sealed Secret Messages, Nearby). */
  anonymous?: boolean;
  read: boolean;
  created_at: string;
  actor: ActivityActor | null;
}

export const notificationsApi = {
  async list(cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<{
      items: ActivityItem[];
      next_cursor: string | null;
    }>('/notifications', { params: cursor ? { cursor } : {}, signal });
    return data;
  },
  async unread(signal?: AbortSignal) {
    const { data } = await apiClient.get<{ notifications: number; messages: number }>(
      '/notifications/unread-count',
      { signal },
    );
    return data;
  },
  async readAll() {
    await apiClient.post('/notifications/read-all');
  },
};
