import { QueryClient, skipToken, useQuery } from '@tanstack/react-query';

import type { FollowStatus } from '@/services/api/follows';

/**
 * One cache for everything several screens show at once: how I relate to a
 * user, and the like / save / count state of a post, reel or story. Screens
 * read it with `useRelation` / `useEngagement`; actions write it optimistically.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export type Relationship =
  | 'none'
  | 'following'
  | 'requested'
  | 'blocked_by_me'
  | 'blocked_me';

export interface UserRelation {
  relationship: Relationship;
  /** They follow me (accepted). */
  follows_you: boolean;
  is_private: boolean;
  muted: boolean;
}

export type EngagementKind = 'post' | 'reel' | 'story';

export interface Engagement {
  liked_by_me: boolean;
  /** Null while the owner hides the count. */
  likes_count: number | null;
  saved_by_me: boolean;
  comments_count: number;
}

export const entityKeys = {
  relations: ['relation'] as const,
  relation: (userId: string) => ['relation', userId] as const,
  engagement: (kind: EngagementKind, id: string) =>
    ['engagement', kind, id] as const,
};

const DEFAULT_RELATION: UserRelation = {
  relationship: 'none',
  follows_you: false,
  is_private: false,
  muted: false,
};

const DEFAULT_ENGAGEMENT: Engagement = {
  liked_by_me: false,
  likes_count: 0,
  saved_by_me: false,
  comments_count: 0,
};

export function relationshipFromFollow(status: FollowStatus): Relationship {
  if (status === 'accepted') return 'following';
  if (status === 'pending') return 'requested';
  return 'none';
}

export function followFromRelationship(r: Relationship): FollowStatus {
  if (r === 'following') return 'accepted';
  if (r === 'requested') return 'pending';
  return 'none';
}

/** Public account, or either of us follows the other; never when blocked. */
export function canMessage(rel: UserRelation | undefined) {
  if (!rel) return false;
  if (rel.relationship === 'blocked_by_me' || rel.relationship === 'blocked_me') {
    return false;
  }
  return !rel.is_private || rel.relationship === 'following' || rel.follows_you;
}

export const getRelation = (userId: string) =>
  queryClient.getQueryData<UserRelation>(entityKeys.relation(userId));

/** Merges into what is known (or the defaults). */
export function setRelation(userId: string, patch: Partial<UserRelation>) {
  queryClient.setQueryData<UserRelation>(entityKeys.relation(userId), prev => ({
    ...DEFAULT_RELATION,
    ...prev,
    ...patch,
  }));
}

/** Server payload shapes that carry the viewer's relation to a user. */
export type UserLike = {
  id: string;
  is_private?: boolean;
  follow_status?: FollowStatus;
  relationship?: Relationship;
  follows_you?: boolean;
  muted?: boolean;
};

/** Records relations that just came from the server; fresh data wins. */
export function primeUsers(users: readonly UserLike[]) {
  for (const u of users) {
    const patch: Partial<UserRelation> = {};
    if (u.relationship) patch.relationship = u.relationship;
    else if (u.follow_status) patch.relationship = relationshipFromFollow(u.follow_status);
    if (u.is_private !== undefined) patch.is_private = u.is_private;
    if (u.follows_you !== undefined) patch.follows_you = u.follows_you;
    if (u.muted !== undefined) patch.muted = u.muted;
    setRelation(u.id, patch);
  }
}

export function clearEntityCache() {
  queryClient.clear();
}

export const getEngagement = (kind: EngagementKind, id: string) =>
  queryClient.getQueryData<Engagement>(entityKeys.engagement(kind, id));

/** Cache write only; use `patchEngagement` (entityActions) so list screens hear it too. */
export function writeEngagement(
  kind: EngagementKind,
  id: string,
  patch: Partial<Engagement>,
) {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<Engagement>;
  if (!Object.keys(clean).length) return;
  queryClient.setQueryData<Engagement>(entityKeys.engagement(kind, id), prev => ({
    ...DEFAULT_ENGAGEMENT,
    ...prev,
    ...clean,
  }));
}

export function primeEngagement(
  kind: EngagementKind,
  items: readonly ({ id: string } & Partial<Engagement>)[],
) {
  for (const { id, liked_by_me, likes_count, saved_by_me, comments_count } of items) {
    writeEngagement(kind, id, { liked_by_me, likes_count, saved_by_me, comments_count });
  }
}

export function forgetEngagement(kind: EngagementKind, id: string) {
  queryClient.removeQueries({ queryKey: entityKeys.engagement(kind, id), exact: true });
}

/** Live relation; `undefined` until primed. Never fetches by itself. */
export function useRelation(userId: string | undefined) {
  return useQuery<UserRelation>(
    {
      queryKey: entityKeys.relation(userId ?? ''),
      queryFn: skipToken,
      enabled: false,
    },
    queryClient,
  ).data;
}

/** Live engagement, falling back to `fallback` (the item as loaded) until the cache knows better. */
export function useEngagement(
  kind: EngagementKind,
  id: string,
  fallback?: Partial<Engagement>,
): Engagement {
  const data = useQuery<Engagement>(
    {
      queryKey: entityKeys.engagement(kind, id),
      queryFn: skipToken,
      enabled: false,
    },
    queryClient,
  ).data;
  return { ...DEFAULT_ENGAGEMENT, ...fallback, ...data };
}
