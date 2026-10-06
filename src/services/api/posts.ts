import type { Adjustments } from '@/features/create/adjustments';

import { apiClient } from './client';
import type { UserSummary } from './follows';
import type { Reel } from './reels';

export interface PostMedia {
  id: string;
  kind: 'image' | 'video';
  url: string;
  width: number | null;
  height: number | null;
  alt_text: string;
  duration_ms: number | null;
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
  mentions: string[];
  /** People picked in "Tag people". */
  tagged_users: UserSummary[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  adjustments?: Adjustments;
  /** Width / height of the frame every carousel item is shown in. */
  aspect_ratio: number;
  /** Null while `hide_like_count` is on, for everyone including the owner. */
  likes_count: number | null;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  hide_like_count: boolean;
  comments_disabled: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
  /** Set when this is a reel shown in the saved list, which mixes posts and reels. */
  reel?: Reel;
}

type SavedEntry = { kind: 'post'; post: Post } | { kind: 'reel'; reel: Reel };

/** Saved reels always show in a tall frame, cropped to fill, whatever shape the video is. */
const REEL_FRAME = 3 / 5;

/** A saved reel in the shape of a one-video post, so it opens like the posts around it. */
export function reelAsPost(reel: Reel): Post {
  return {
    id: reel.id,
    author: reel.author,
    media: [
      {
        id: reel.id,
        kind: 'video',
        url: reel.video_url,
        width: reel.width,
        height: reel.height,
        alt_text: '',
        duration_ms: reel.duration_ms,
      },
    ],
    caption: reel.caption,
    mentions: reel.mentions,
    tagged_users: [],
    location_name: reel.location_name,
    location_lat: reel.location_lat,
    location_lng: reel.location_lng,
    aspect_ratio: REEL_FRAME,
    likes_count: reel.likes_count,
    comments_count: reel.comments_count,
    liked_by_me: reel.liked_by_me,
    saved_by_me: reel.saved_by_me ?? true,
    hide_like_count: reel.hide_like_count,
    comments_disabled: reel.comments_disabled,
    is_owner: reel.is_owner,
    created_at: reel.created_at,
    updated_at: reel.created_at,
    reel,
  };
}

export interface CreatePostInput {
  media_ids: string[];
  caption: string;
  alt_texts: string[];
  location_name: string;
  location_lat?: number | null;
  location_lng?: number | null;
  adjustments?: Adjustments;
  tagged_user_ids?: string[];
  aspect_ratio: number;
  hide_like_count: boolean;
  comments_disabled: boolean;
  /** Same id on every retry, so a timed-out share is never posted twice. */
  client_upload_id: string;
}

export interface PlaceSuggestion {
  name: string;
  post_count: number;
  /** Set for real places from the map search. */
  area?: string;
  latitude?: number;
  longitude?: number;
}

export interface LikeResult {
  liked: boolean;
  likes_count: number | null;
  post: Post;
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

  /** Saved posts and reels together, newest save first. */
  async saved(cursor?: string | null, signal?: AbortSignal): Promise<Page<Post>> {
    const { data } = await apiClient.get<Page<SavedEntry>>('/users/me/saved', {
      params: cursor ? { cursor } : {},
      signal,
    });
    return {
      items: data.items.map(e => (e.kind === 'post' ? e.post : reelAsPost(e.reel))),
      next_cursor: data.next_cursor,
    };
  },

  /** Idempotent: repeating a request never flips the like the wrong way. */
  async setLiked(id: string, liked: boolean) {
    const { data } = liked
      ? await apiClient.put<LikeResult>(`/posts/${id}/like`)
      : await apiClient.delete<LikeResult>(`/posts/${id}/like`);
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
