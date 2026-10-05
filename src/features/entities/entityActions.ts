import { setLikeState } from '@/features/posts/likeSync';
import { emitPostEvent } from '@/features/posts/postEvents';
import { followsApi } from '@/services/api/follows';
import { postsApi } from '@/services/api/posts';
import { safetyApi } from '@/services/api/safety';
import { storiesApi } from '@/services/api/stories';

import {
  type Engagement,
  type EngagementKind,
  entityKeys,
  getEngagement,
  getRelation,
  queryClient,
  relationshipFromFollow,
  setRelation,
  type UserRelation,
  writeEngagement,
} from './entityCache';
import { runOptimistic } from './optimistic';

/** Writes the cache and tells list screens that keep their own copies. */
export function patchEngagement(
  kind: EngagementKind,
  id: string,
  patch: Partial<Engagement>,
) {
  if (kind === 'story') writeEngagement(kind, id, patch);
  else emitPostEvent({ type: 'patch', kind, id, patch });
}

function restoreRelation(userId: string, prev: UserRelation | undefined) {
  if (prev) {
    queryClient.setQueryData(entityKeys.relation(userId), prev);
  } else {
    queryClient.resetQueries({ queryKey: entityKeys.relation(userId), exact: true });
  }
}

function changeRelation<T>(
  userId: string,
  patch: Partial<UserRelation>,
  run: () => Promise<T>,
  errorMessage: string,
  commit?: (result: T) => void,
) {
  return runOptimistic({
    key: `relation:${userId}`,
    apply: () => {
      const prev = getRelation(userId);
      setRelation(userId, patch);
      return () => restoreRelation(userId, prev);
    },
    run,
    commit,
    errorMessage,
  });
}

/** Public: Following at once. Private: Requested (counts change only when accepted). */
export function followUser(user: { id: string; is_private: boolean }) {
  return changeRelation(
    user.id,
    {
      relationship: user.is_private ? 'requested' : 'following',
      is_private: user.is_private,
    },
    () => followsApi.follow(user.id),
    "Couldn't follow. Please try again.",
    r => setRelation(user.id, { relationship: relationshipFromFollow(r.status) }),
  );
}

export function unfollowUser(userId: string) {
  return changeRelation(
    userId,
    { relationship: 'none' },
    () => followsApi.unfollow(userId),
    "Couldn't unfollow. Please try again.",
  );
}

export function cancelFollowRequest(userId: string) {
  return changeRelation(
    userId,
    { relationship: 'none' },
    () => followsApi.unfollow(userId),
    "Couldn't cancel the request. Please try again.",
  );
}

/** Also drops follows both ways, like the server does. */
export function blockUser(userId: string) {
  return changeRelation(
    userId,
    { relationship: 'blocked_by_me', follows_you: false },
    () => safetyApi.block(userId),
    "Couldn't block. Please try again.",
  );
}

export function unblockUser(userId: string) {
  return changeRelation(
    userId,
    { relationship: 'none' },
    () => safetyApi.unblock(userId),
    "Couldn't unblock. Please try again.",
  );
}

export function setMuted(userId: string, muted: boolean) {
  return changeRelation(
    userId,
    { muted },
    () => (muted ? safetyApi.mute(userId) : safetyApi.unmute(userId)),
    muted ? "Couldn't mute. Please try again." : "Couldn't unmute. Please try again.",
  );
}

function currentEngagement(
  kind: EngagementKind,
  id: string,
  fallback?: Partial<Engagement>,
): Engagement {
  return {
    liked_by_me: false,
    likes_count: 0,
    saved_by_me: false,
    comments_count: 0,
    ...fallback,
    ...getEngagement(kind, id),
  };
}

/**
 * Likes / unlikes everywhere at once. Posts and reels go through `likeSync`,
 * which collapses quick taps into one final request and reverts on failure.
 */
export function toggleLike(
  kind: EngagementKind,
  id: string,
  fallback?: Partial<Engagement>,
) {
  const cur = currentEngagement(kind, id, fallback);
  const liked = !cur.liked_by_me;
  if (kind !== 'story') {
    setLikeState(kind, id, { liked_by_me: cur.liked_by_me, likes_count: cur.likes_count }, liked);
    return Promise.resolve();
  }
  return runOptimistic({
    key: `engagement:story:${id}`,
    apply: () => {
      patchEngagement('story', id, {
        liked_by_me: liked,
        likes_count:
          cur.likes_count === null
            ? null
            : Math.max(0, cur.likes_count + (liked ? 1 : -1)),
      });
      return () =>
        patchEngagement('story', id, {
          liked_by_me: cur.liked_by_me,
          likes_count: cur.likes_count,
        });
    },
    run: () => storiesApi.setLiked(id, liked),
    errorMessage: "Couldn't update the like. Please try again.",
  });
}

/** Posts only for now; reels get a save endpoint with the Reels feature. */
export function toggleSave(id: string, fallback?: Partial<Engagement>) {
  const cur = currentEngagement('post', id, fallback);
  return runOptimistic({
    key: `engagement:post:${id}:save`,
    apply: () => {
      patchEngagement('post', id, { saved_by_me: !cur.saved_by_me });
      return () => patchEngagement('post', id, { saved_by_me: cur.saved_by_me });
    },
    run: () => postsApi.save(id),
    commit: r => patchEngagement('post', id, { saved_by_me: r.saved }),
    errorMessage: "Couldn't update saved. Please try again.",
  });
}

/** After adding (+1) or deleting (-1) a comment. */
export function adjustCommentCount(
  kind: EngagementKind,
  id: string,
  delta: number,
  fallback?: Partial<Engagement>,
) {
  const cur = currentEngagement(kind, id, fallback);
  patchEngagement(kind, id, {
    comments_count: Math.max(0, cur.comments_count + delta),
  });
}
