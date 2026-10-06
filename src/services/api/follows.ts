import { apiClient } from './client';

export type FollowStatus = 'none' | 'pending' | 'accepted';

/** A user in lists and search results, with the viewer's follow state. */
export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_private: boolean;
  is_self: boolean;
  follow_status: FollowStatus;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  website: string;
  is_private: boolean;
  is_verified: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_self: boolean;
  follow_status: FollowStatus;
  follows_you: boolean;
  /** The viewer muted this account (hides their posts and stories from feeds). */
  muted?: boolean;
  /** False for a private account the viewer doesn't follow. */
  can_view_content: boolean;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface FollowRequest {
  id: string;
  user: UserSummary;
  created_at: string;
}

type PageParams = { cursor?: string | null; q?: string; signal?: AbortSignal };

const pageParams = ({ cursor, q }: PageParams) => ({
  ...(cursor ? { cursor } : {}),
  ...(q ? { q } : {}),
});

export const followsApi = {
  async profile(username: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<Profile>(
      `/users/by-username/${encodeURIComponent(username)}`,
      { signal },
    );
    return data;
  },

  async follow(userId: string) {
    const { data } = await apiClient.post<{ status: FollowStatus }>(
      `/users/${userId}/follow`,
    );
    return data;
  },

  /** Unfollows, or cancels a pending request. */
  async unfollow(userId: string) {
    await apiClient.delete(`/users/${userId}/follow`);
  },

  async removeFollower(userId: string) {
    await apiClient.delete(`/users/me/followers/${userId}`);
  },

  async connections(
    userId: string,
    kind: 'followers' | 'following',
    params: PageParams = {},
  ) {
    const { data } = await apiClient.get<Page<UserSummary>>(
      `/users/${userId}/${kind}`,
      { params: pageParams(params), signal: params.signal },
    );
    return data;
  },

  async requests(params: PageParams = {}) {
    const { data } = await apiClient.get<
      Page<FollowRequest> & { total: number }
    >('/users/me/follow-requests', {
      params: pageParams(params),
      signal: params.signal,
    });
    return data;
  },

  async acceptRequest(id: string) {
    const { data } = await apiClient.post<{ user: UserSummary | null }>(
      `/follow-requests/${id}/accept`,
    );
    return data;
  },

  async declineRequest(id: string) {
    await apiClient.post(`/follow-requests/${id}/decline`);
  },

  async suggestUsers(signal?: AbortSignal) {
    const { data } = await apiClient.get<{ users: UserSummary[] }>(
      '/users/suggestions',
      { signal },
    );
    return data.users;
  },

  /** `@` picker: people you follow for an empty query, best name matches while typing. */
  async mentionUsers(q: string, limit: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ users: UserSummary[] }>(
      '/users/mention-suggestions',
      { params: { q, limit }, signal },
    );
    return data.users;
  },

  async searchUsers(q: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ users: UserSummary[] }>('/search', {
      params: { q, type: 'users' },
      signal,
    });
    return data.users;
  },
};
