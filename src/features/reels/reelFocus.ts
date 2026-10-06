import type { Reel } from '@/services/api/reels';

type Focus = Reel | { id: string };

let queued: Focus | null = null;
let queuedUser: string | null = null;

/**
 * The profile grid asks the Reels tab to open this video first. With
 * `fromUserId` the tab plays only that person's reels and then ends.
 */
export function focusReel(reel: Reel, fromUserId?: string) {
  queued = reel;
  queuedUser = fromUserId ?? null;
}

/** A notification only knows the id; the tab scrolls to it once the feed loads. */
export function focusReelId(id: string) {
  queued = { id };
  queuedUser = null;
}

/**
 * The list with `pin` first and nowhere else, keeping the copy already in the
 * list (it has the latest likes). Null when it is already like that.
 */
export function keepPinnedFirst<T extends { id: string }>(items: T[], pin: T): T[] | null {
  const first = items[0]?.id === pin.id;
  const repeated = items.some((item, i) => i > 0 && item.id === pin.id);
  if (first && !repeated) return null;
  return [items.find(item => item.id === pin.id) ?? pin, ...items.filter(item => item.id !== pin.id)];
}

export function consumeFocusedReel() {
  const reel = queued;
  queued = null;
  return reel;
}

/** Whose reels the last focused reel came from, if it was opened from a profile. */
export function consumeFocusedUser() {
  const userId = queuedUser;
  queuedUser = null;
  return userId;
}
