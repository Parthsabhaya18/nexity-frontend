import { apiClient } from './client';
import type { UserSummary } from './follows';

export interface Reel {
  id: string;
  author: UserSummary;
  video_url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  caption: string;
  hashtags: string[];
  mentions: string[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  filter?: string;
  music_title: string;
  audio_muted?: boolean;
  cover_time_ms?: number;
  cover_url?: string | null;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
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
    filter?: string;
    music_title?: string;
    audio_muted?: boolean;
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

  async like(id: string) {
    const { data } = await apiClient.post<Reel>(`/reels/${id}/like`);
    return data;
  },

  async remove(id: string) {
    await apiClient.delete(`/reels/${id}`);
  },
};
