import { apiClient } from './client';
import type { UserSummary } from './follows';

/** People the user opened from search. The server leaves out blocked accounts. */
export const searchHistoryApi = {
  async list(signal?: AbortSignal) {
    const { data } = await apiClient.get<{ users: UserSummary[] }>(
      '/search/history',
      { signal },
    );
    return data.users;
  },

  async add(userId: string) {
    await apiClient.post('/search/history', { user_id: userId });
  },

  async remove(userId: string) {
    await apiClient.delete(`/search/history/${userId}`);
  },

  async clear() {
    await apiClient.delete('/search/history');
  },
};
