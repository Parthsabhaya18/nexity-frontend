import type { Reel } from '@/services/api/reels';

type Focus = Reel | { id: string };

let queued: Focus | null = null;

/** The profile grid asks the Reels tab to open this video first. */
export function focusReel(reel: Reel) {
  queued = reel;
}

/** A notification only knows the id; the tab scrolls to it once the feed loads. */
export function focusReelId(id: string) {
  queued = { id };
}

export function consumeFocusedReel() {
  const reel = queued;
  queued = null;
  return reel;
}
