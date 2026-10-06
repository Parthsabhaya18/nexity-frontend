import { apiClient } from './client';
import type { UserSummary } from './follows';
import type { Comment } from './posts';

export interface Reel {
  id: string;
  author: UserSummary;
  video_url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  caption: string;
  mentions: string[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  audio_muted?: boolean;
  cover_time_ms?: number;
  cover_url?: string | null;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  /** Null while the owner hides the like count. */
  likes_count: number | null;
  comments_count: number;
  hide_like_count: boolean;
  comments_disabled: boolean;
  liked_by_me: boolean;
  saved_by_me?: boolean;
  is_owner: boolean;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export const reelsApi = {
  async create(input: {
    video_media_id: string;
    caption: string;
    location_name: string;
    location_lat?: number | null;
    location_lng?: number | null;
    audio_muted?: boolean;
    hide_like_count?: boolean;
    comments_disabled?: boolean;
    cover_time_ms?: number;
    cover_media_id?: string;
    client_upload_id: string;
    trim_start_ms?: number | null;
    trim_end_ms?: number | null;
  }) {
    const { data } = await apiClient.post<Reel>('/reels', input);
    return data;
  },

  async feed(cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Reel>>('/reels', {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async byUser(userId: string, cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Reel>>(`/users/${userId}/reels`, {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async save(id: string) {
    const { data } = await apiClient.post<{ saved: boolean; reel: Reel }>(`/reels/${id}/save`);
    return data;
  },

  async get(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<Reel>(`/reels/${id}`, { signal });
    return data;
  },

  /** Idempotent: repeating a request never flips the like the wrong way. */
  async setLiked(id: string, liked: boolean) {
    const { data } = liked
      ? await apiClient.put<Reel>(`/reels/${id}/like`)
      : await apiClient.delete<Reel>(`/reels/${id}/like`);
    return data;
  },

  async update(
    id: string,
    body: Partial<Pick<Reel, 'caption' | 'hide_like_count' | 'comments_disabled'>>,
  ) {
    const { data } = await apiClient.patch<Reel>(`/reels/${id}`, body);
    return data;
  },

  async comments(id: string, cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Comment>>(`/reels/${id}/comments`, {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async addComment(id: string, body: string) {
    const { data } = await apiClient.post<Comment>(`/reels/${id}/comments`, {
      body,
    });
    return data;
  },

  async remove(id: string) {
    await apiClient.delete(`/reels/${id}`);
  },
};
