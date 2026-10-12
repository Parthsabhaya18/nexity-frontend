import type { NearbyHint } from '@/services/api/secretMessages';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** Day-level only: anonymous items never show an exact time. */
export function dayLabel(day: string, now = new Date()) {
  if (day === localKey(now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (day === localKey(y)) return 'Yesterday';
  const [, m, d] = day.split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : day;
}

export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function nearText(hint: NearbyHint | null | undefined) {
  if (hint?.state === 'today') return 'This person was near you today.';
  if (hint?.state === 'yesterday') return 'This person was near you yesterday.';
  return null;
}

export const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
};

export const newClientId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
