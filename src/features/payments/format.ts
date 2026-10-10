import type { Period, PlanId } from '@/services/api/subscriptions';

/** Paise → "₹249" / "₹199.20". */
export function inr(paise: number) {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "7 Nov 2026" in the device's time zone. */
export function day(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const PERIOD_LABEL: Record<Period, string> = {
  monthly: 'Monthly',
  quarterly: '3 months',
  yearly: 'Yearly',
};

export const PERIOD_UNIT: Record<Period, string> = {
  monthly: 'month',
  quarterly: '3 months',
  yearly: 'year',
};

export const PLAN_NAME: Record<PlanId, string> = {
  free: 'Free',
  plus: 'Plus',
  premium: 'Premium',
};
