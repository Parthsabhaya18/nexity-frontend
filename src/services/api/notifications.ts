import { apiClient } from './client';

export interface ActivityActor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ActivityItem {
  id: string;
  type: 'comment_post' | 'comment_reel';
  text: string;
  post_id: string | null;
  reel_id: string | null;
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
