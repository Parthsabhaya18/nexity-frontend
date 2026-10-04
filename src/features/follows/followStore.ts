import { useSyncExternalStore } from 'react';

import type { FollowStatus } from '@/services/api/follows';

/**
 * Latest known follow state per user id, so a follow on one screen shows on
 * every other screen at once. Fresh server data overwrites it via `prime`.
 */
const statuses = new Map<string, FollowStatus>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFollowStatus(userId: string, status: FollowStatus) {
  if (statuses.get(userId) === status) return;
  statuses.set(userId, status);
  notify();
}

/** Records statuses that just came from the server. */
export function primeFollowStatuses(
  users: readonly { id: string; follow_status: FollowStatus }[],
) {
  let changed = false;
  for (const u of users) {
    if (statuses.get(u.id) !== u.follow_status) {
      statuses.set(u.id, u.follow_status);
      changed = true;
    }
  }
  if (changed) notify();
}

export function clearFollowStatuses() {
  statuses.clear();
  notify();
}

export function useFollowStatus(userId: string, fallback: FollowStatus) {
  const known = useSyncExternalStore(subscribe, () => statuses.get(userId));
  return known ?? fallback;
}
