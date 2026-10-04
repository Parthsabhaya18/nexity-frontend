import { apiClient } from './client';

export type ReportTarget = 'post' | 'reel' | 'story' | 'user' | 'message' | 'comment';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'nudity'
  | 'violence'
  | 'self_harm'
  | 'other';

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export const safetyApi = {
  async block(userId: string) {
    await apiClient.post(`/users/${userId}/block`);
  },
  async unblock(userId: string) {
    await apiClient.delete(`/users/${userId}/block`);
  },
  async blocked() {
    const { data } = await apiClient.get<{ items: BlockedUser[] }>('/users/me/blocked');
    return data.items;
  },
  async report(input: {
    target_type: ReportTarget;
    target_id: string;
    reason: ReportReason;
    details?: string;
  }) {
    await apiClient.post('/reports', input);
  },
};
