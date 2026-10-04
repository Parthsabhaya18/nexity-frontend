const MIN = 60_000;
const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function shortDate(ts: number) {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return sameYear ? base : `${base} ${d.getFullYear()}`;
}

/** Chat day divider: Today, Yesterday, 12 Mar. */
export function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return shortDate(ts);
}

/** 9:41 am */
export function clockTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Compact form for list rows: now, 5m, 3h, 2d, 12 Mar. */
export function timeAgo(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  return shortDate(ts);
}

/**
 * Chat presence line: "Active now" while connected, then "Active 5m ago" up to a week.
 * Older activity returns null (nothing shown), like Instagram.
 */
export function presenceLabel(online: boolean, lastActiveAt: string | null) {
  if (online) return 'Active now';
  if (!lastActiveAt) return null;
  const d = Math.max(0, Date.now() - Date.parse(lastActiveAt));
  if (d < MIN) return 'Active just now';
  if (d < HOUR) return `Active ${Math.floor(d / MIN)}m ago`;
  if (d < DAY) return `Active ${Math.floor(d / HOUR)}h ago`;
  if (d < 7 * DAY) return `Active ${Math.floor(d / DAY)}d ago`;
  return null;
}

/** Sentence form: Just now, 5 minutes ago, Yesterday, 12 Mar. */
export function timeAgoLong(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  if (d < MIN) return 'Just now';
  if (d < HOUR) {
    const m = Math.floor(d / MIN);
    return `${m} minute${m > 1 ? 's' : ''} ago`;
  }
  if (d < DAY) {
    const h = Math.floor(d / HOUR);
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }
  if (d < 7 * DAY) {
    const n = Math.floor(d / DAY);
    return n === 1 ? 'Yesterday' : `${n} days ago`;
  }
  return shortDate(ts);
}
