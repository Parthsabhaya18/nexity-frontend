import { type Dispatch, type SetStateAction, useEffect } from 'react';

import { forgetEngagement, writeEngagement } from '@/features/entities/entityCache';
import type { Post } from '@/services/api/posts';
import type { Reel } from '@/services/api/reels';

/** Fields that can change on a post or reel while it is open on several screens. */
export type EngagementPatch = Partial<
  Pick<
    Post,
    | 'liked_by_me'
    | 'likes_count'
    | 'comments_count'
    | 'hide_like_count'
    | 'comments_disabled'
    | 'caption'
    | 'saved_by_me'
  >
>;

export type PostEvent =
  | { type: 'patch'; kind: 'post' | 'reel'; id: string; patch: EngagementPatch }
  | { type: 'remove'; kind: 'post' | 'reel'; id: string }
  | { type: 'create'; kind: 'post'; post: Post }
  | { type: 'create'; kind: 'reel'; reel: Reel };

type Listener = (event: PostEvent) => void;
const listeners = new Set<Listener>();

/**
 * Keeps every screen showing the same post (feed, profile grid, viewer,
 * reels) in step after a like, comment, edit or delete.
 */
export function emitPostEvent(event: PostEvent) {
  if (event.type === 'patch') {
    const { liked_by_me, likes_count, saved_by_me, comments_count } = event.patch;
    writeEngagement(event.kind, event.id, {
      liked_by_me,
      likes_count,
      saved_by_me,
      comments_count,
    });
  } else if (event.type === 'remove') {
    forgetEngagement(event.kind, event.id);
  }
  listeners.forEach(l => l(event));
}

export function onPostEvent(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps a list state in step with likes, comment counts, edits and deletes. */
export function useEngagementSync<T extends { id: string }>(
  kind: 'post' | 'reel',
  setItems: Dispatch<SetStateAction<T[]>>,
) {
  useEffect(
    () =>
      onPostEvent(event => setItems(prev => applyPatch(prev, event, kind))),
    [kind, setItems],
  );
}

/** Applies a patch to the matching item of a list. */
export function applyPatch<T extends { id: string }>(
  items: T[],
  event: PostEvent,
  kind: 'post' | 'reel',
): T[] {
  if (event.type === 'create' || event.kind !== kind) return items;
  if (event.type === 'remove') return items.filter(i => i.id !== event.id);
  return items.map(i => (i.id === event.id ? { ...i, ...event.patch } : i));
}
