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

/** Compact form for list rows: now, 5m, 3h, 2d, 12 Mar. */
export function timeAgo(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  return shortDate(ts);
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
