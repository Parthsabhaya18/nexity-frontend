import type { StoryOverlay } from '@/features/stories/overlay';

import { apiClient } from './client';
import type { UserSummary } from './follows';

export interface StoryItem {
  id: string;
  kind: 'image' | 'video';
  url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  music_title: string;
  location_name?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  filter?: string;
  overlays?: StoryOverlay[];
  created_at: string;
  expires_at: string;
  seen: boolean;
}

export interface StoryGroup {
  user: UserSummary;
  seen: boolean;
  stories: StoryItem[];
}

export const storiesApi = {
  async create(input: {
    media_id: string;
    music_title?: string;
    location_name?: string;
    location_lat?: number | null;
    location_lng?: number | null;
    filter?: string;
    overlays?: StoryOverlay[];
  }) {
    const { data } = await apiClient.post<Omit<StoryItem, 'seen'>>(
      '/stories',
      input,
    );
    return data;
  },

  async vote(storyId: string, overlayId: string, option: number) {
    const { data } = await apiClient.post<Omit<StoryItem, 'seen'>>(
      `/stories/${storyId}/vote`,
      {
        overlay_id: overlayId,
        option,
      },
    );
    return data;
  },

  async reply(storyId: string, overlayId: string, body: string) {
    await apiClient.post(`/stories/${storyId}/reply`, {
      overlay_id: overlayId,
      body,
    });
  },

  async tray(signal?: AbortSignal) {
    const { data } = await apiClient.get<{ items: StoryGroup[] }>(
      '/stories/tray',
      {
        signal,
      },
    );
    return data.items;
  },

  async view(id: string) {
    await apiClient.post(`/stories/${id}/view`);
  },

  async viewers(id: string) {
    const { data } = await apiClient.get<{ items: UserSummary[] }>(
      `/stories/${id}/viewers`,
    );
    return data.items;
  },

  async remove(id: string) {
    await apiClient.delete(`/stories/${id}`);
  },
};
