import {
  entityKeys,
  followFromRelationship,
  primeUsers,
  queryClient,
  relationshipFromFollow,
  setRelation,
  useRelation,
} from '@/features/entities/entityCache';
import type { FollowStatus } from '@/services/api/follows';

/**
 * Follow state per user id, kept in the shared entity cache so a follow on one
 * screen shows on every other screen at once. Fresh server data overwrites it
 * via `primeFollowStatuses`.
 */
export function setFollowStatus(userId: string, status: FollowStatus) {
  setRelation(userId, { relationship: relationshipFromFollow(status) });
}

/** Records statuses (and privacy) that just came from the server. */
export function primeFollowStatuses(
  users: readonly {
    id: string;
    follow_status: FollowStatus;
    is_private?: boolean;
    follows_you?: boolean;
  }[],
) {
  primeUsers(users);
}

export function clearFollowStatuses() {
  queryClient.removeQueries({ queryKey: entityKeys.relations });
}

export function useFollowStatus(userId: string, fallback: FollowStatus) {
  const known = useRelation(userId);
  return known ? followFromRelationship(known.relationship) : fallback;
}
