import type { StoryGroup } from '@/services/api/stories';

/** Drops stories whose 24 hours are over, and people left with none. */
export function dropExpired(groups: StoryGroup[]) {
  const now = Date.now();
  let changed = false;
  const live = groups.flatMap(group => {
    const items = group.stories.filter(s => Date.parse(s.expires_at) > now);
    if (items.length === group.stories.length) return [group];
    changed = true;
    return items.length ? [{ ...group, stories: items }] : [];
  });
  return changed ? live : groups;
}

/** Milliseconds until the first of these stories expires, or null if none. */
export function msUntilNextExpiry(groups: StoryGroup[]) {
  let first = Infinity;
  for (const group of groups) {
    for (const s of group.stories) first = Math.min(first, Date.parse(s.expires_at));
  }
  return Number.isFinite(first) ? Math.max(0, first - Date.now()) : null;
}
