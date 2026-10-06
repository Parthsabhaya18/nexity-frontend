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
  location_name?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  overlays?: StoryOverlay[];
  created_at: string;
  expires_at: string;
  seen: boolean;
  liked_by_me?: boolean;
  /** Set when the story is a post or reel added from its share sheet. */
  shared?: StoryShared | null;
}

/** Where a shared post/reel sits on the story: centre (0–1 of the screen), zoom, and look. */
export interface SharedLayout {
  x: number;
  y: number;
  scale: number;
  /** `card` shows the full post (author, photo, caption); `media` only the photo. */
  style: 'media' | 'card';
}

export interface StoryShared {
  kind: 'post' | 'reel';
  id: string;
  username: string;
  avatar_url?: string | null;
  caption?: string;
  aspect_ratio: number;
  layout?: SharedLayout;
}

export type StoryViewerRow = UserSummary & { liked: boolean };

export interface StoryGroup {
  user: UserSummary;
  seen: boolean;
  stories: StoryItem[];
}

export const storiesApi = {
  async create(input: {
    media_id: string;
    location_name?: string;
    location_lat?: number | null;
    location_lng?: number | null;
    overlays?: StoryOverlay[];
  }) {
    const { data } = await apiClient.post<Omit<StoryItem, 'seen'>>(
      '/stories',
      input,
    );
    return data;
  },

  /** Adds a post or reel to your story. */
  async share(input: {
    kind: 'post' | 'reel';
    id: string;
    media_index?: number;
    layout?: SharedLayout;
    location_name?: string;
    location_lat?: number | null;
    location_lng?: number | null;
    overlays?: StoryOverlay[];
  }) {
    const { data } = await apiClient.post<Omit<StoryItem, 'seen'>>('/stories/share', input);
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

  /** Idempotent: repeating a request never flips the like the wrong way. */
  async setLiked(id: string, liked: boolean) {
    if (liked) await apiClient.put(`/stories/${id}/like`);
    else await apiClient.delete(`/stories/${id}/like`);
  },

  /** A private reply to the story's owner, delivered in your chat with them. */
  async message(id: string, body: string) {
    await apiClient.post(`/stories/${id}/message`, { body });
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

  /** People who liked the story come first. */
  async viewers(id: string) {
    const { data } = await apiClient.get<{ items: StoryViewerRow[] }>(
      `/stories/${id}/viewers`,
    );
    return data.items;
  },

  async remove(id: string) {
    await apiClient.delete(`/stories/${id}`);
  },
};
