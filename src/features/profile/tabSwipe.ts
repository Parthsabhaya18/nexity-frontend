/** How far, or how fast, a sideways swipe must go to switch tabs. */
const SWIPE_TAB_DISTANCE = 60;
const SWIPE_TAB_VELOCITY = 0.4;

/** Clearly sideways, so vertical scrolling and taps on tiles keep working. */
export const isTabSwipe = (dx: number, dy: number) =>
  Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2;

/** The tab one step away from `current`: swipe left → next, right → previous. */
export function swipedTab<T>(tabs: readonly T[], current: T, dx: number, vx: number) {
  if (Math.abs(dx) < SWIPE_TAB_DISTANCE && Math.abs(vx) < SWIPE_TAB_VELOCITY) return null;
  return tabs[tabs.indexOf(current) + (dx < 0 ? 1 : -1)] ?? null;
}
