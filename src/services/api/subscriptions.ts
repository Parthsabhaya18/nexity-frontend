import { apiClient } from './client';

export type PlanId = 'free' | 'plus' | 'premium';
export type Period = 'monthly' | 'quarterly' | 'yearly';

export interface PlanLimits {
  /** -1 = unlimited (a daily fair-use cap still applies), 0 = not allowed. */
  secret_messages_per_month: number;
  secret_messages_per_day_fair_use: number;
  crush_spots: number;
  read_secret: boolean;
  nearby: boolean;
  badge: boolean;
}

export interface PeriodPrice {
  amount_paise: number;
  months: number;
  per_month_paise: number;
  save_pct: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  rank: number;
  price_inr: number;
  mrp_inr: number;
  mrp_paise: number;
  pricing: Record<Period, PeriodPrice>;
  features: string[];
  /** Crossed-out lines ("what this plan does not include"). */
  missing_features: string[];
  /** Glyph key: `user`, `sparkles`, `crown`, … */
  icon: string;
  /** Ribbon such as "Most popular". Present plans are highlighted. */
  highlight_label: string | null;
  cta_label: string | null;
  limits: PlanLimits;
}

export interface PlansPage {
  title: string;
  subtitle: string;
  current_prefix: string;
  checkout_unavailable_note: string;
  reasons: Record<string, { icon: string; title: string; text: string }>;
  compare: {
    title: string;
    feature_label: string;
    rows: { label: string; cells: Record<string, string | boolean> }[];
  };
  trust: { icon: string; text: string }[];
}

export interface SecretUsage {
  secret_messages_this_month: number;
  /** `null` = unlimited. */
  secret_messages_limit: number | null;
  secret_messages_left: number | null;
  month_resets_at: string;
}

export interface Billing {
  /** `razorpay`, `dev` (test switch) or `admin`. */
  source: string | null;
  period: Period | null;
  autopay: boolean;
  cancel_at_period_end: boolean;
  status: 'active' | 'in_grace' | 'canceled' | null;
  next_charge_at: string | null;
  price_paise: number | null;
  /** Masked: "UPI · @okhdfcbank", "Visa •••• 4242". */
  method_display: string | null;
}

export interface Subscription {
  plan: PlanId;
  status: 'active' | 'none';
  current_period_end: string | null;
  limits: PlanLimits;
  usage: SecretUsage;
  billing: Billing | null;
}

export interface PlansResponse {
  data: Plan[];
  page: PlansPage;
  /** False on iOS (Apple IAP only) or when payments are off. */
  checkout_available: boolean;
  payments: {
    provider: 'razorpay';
    /** `simulator` = test build without Razorpay keys (no money moves). */
    mode: 'live' | 'test' | 'simulator' | 'off';
    methods: string[];
    one_time_only_methods: string[];
  };
  dev_switch: boolean;
}

export const subscriptionsApi = {
  async plans() {
    const { data } = await apiClient.get<PlansResponse>('/plans');
    return data;
  },
  async me() {
    const { data } = await apiClient.get<Subscription>('/subscriptions/me');
    return data;
  },
  async cancelAutopay() {
    const { data } = await apiClient.post<Subscription>('/subscriptions/me/cancel');
    return data;
  },
  /** Development builds only. */
  async devActivate(plan: PlanId) {
    const { data } = await apiClient.post<Subscription>(
      '/subscriptions/dev/activate',
      { plan },
    );
    return data;
  },
};
