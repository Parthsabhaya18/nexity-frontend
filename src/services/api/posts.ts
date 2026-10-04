import type { Adjustments } from '@/features/create/adjustments';

import { apiClient } from './client';
import type { UserSummary } from './follows';

export interface PostMedia {
  id: string;
  kind: 'image' | 'video';
  url: string;
  width: number | null;
  height: number | null;
  alt_text: string;
  duration_ms: number | null;
  /** Named colour look. Missing means Normal. */
  filter?: string;
}

export interface Comment {
  id: string;
  body: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  created_at: string;
  replies: Comment[];
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Post {
  id: string;
  author: UserSummary;
  /** Carousel order. */
  media: PostMedia[];
  caption: string;
  hashtags: string[];
  mentions: string[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  adjustments?: Adjustments;
  music_title: string;
  /** Width / height of the frame every carousel item is shown in. */
  aspect_ratio: number;
  /** Null when the owner hid the like count. */
  likes_count: number | null;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  hide_like_count: boolean;
  comments_disabled: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePostInput {
  media_ids: string[];
  caption: string;
  alt_texts: string[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  adjustments?: Adjustments;
  /** One look per photo, in carousel order. */
  filters?: string[];
  music_title: string;
  aspect_ratio: number;
  hide_like_count: boolean;
  comments_disabled: boolean;
  /** Same id on every retry, so a timed-out share is never posted twice. */
  client_upload_id: string;
}

export interface TagSuggestion {
  name: string;
  post_count: number;
}

export interface PlaceSuggestion {
  name: string;
  post_count: number;
  /** Set for real places from the map search. */
  area?: string;
  latitude?: number;
  longitude?: number;
}

export const postsApi = {
  async create(input: CreatePostInput) {
    const { data } = await apiClient.post<Post>('/posts', input);
    return data;
  },

  async get(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<Post>(`/posts/${id}`, { signal });
    return data;
  },

  async searchTags(q: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ tags: TagSuggestion[] }>('/search', {
      params: { q, type: 'tags', limit: 10 },
      signal,
    });
    return data.tags;
  },

  async feed(cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Post>>('/feed', {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async byUser(userId: string, cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Post>>(`/users/${userId}/posts`, {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async saved(cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Post>>('/users/me/saved-posts', {
      params: cursor ? { cursor } : {},
      signal,
    });
    return data;
  },

  async byTag(tag: string, cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Post>>(
      `/tags/${encodeURIComponent(tag)}/posts`,
      { params: cursor ? { cursor } : {}, signal },
    );
    return data;
  },

  async like(id: string) {
    const { data } = await apiClient.post<{
      liked: boolean;
      likes_count: number | null;
      post: Post;
    }>(`/posts/${id}/like`);
    return data;
  },

  async save(id: string) {
    const { data } = await apiClient.post<{ saved: boolean; post: Post }>(
      `/posts/${id}/save`,
    );
    return data;
  },

  async update(
    id: string,
    body: Partial<
      Pick<
        CreatePostInput,
        'caption' | 'location_name' | 'hide_like_count' | 'comments_disabled'
      >
    >,
  ) {
    const { data } = await apiClient.patch<Post>(`/posts/${id}`, body);
    return data;
  },

  async remove(id: string) {
    await apiClient.delete(`/posts/${id}`);
  },

  async comments(id: string, cursor?: string | null, signal?: AbortSignal) {
    const { data } = await apiClient.get<Page<Comment>>(
      `/posts/${id}/comments`,
      {
        params: cursor ? { cursor } : {},
        signal,
      },
    );
    return data;
  },

  async addComment(id: string, body: string, parentId?: string) {
    const { data } = await apiClient.post<Comment>(`/posts/${id}/comments`, {
      body,
      ...(parentId ? { parent_id: parentId } : {}),
    });
    return data;
  },

  async deleteComment(id: string) {
    await apiClient.delete(`/comments/${id}`);
  },

  async searchPlaces(q: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ places: PlaceSuggestion[] }>(
      '/search',
      { params: { q, type: 'places', limit: 15 }, signal },
    );
    return data.places;
  },
};
