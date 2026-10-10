import { apiClient } from './client';
import type { Period, PlanId, Subscription } from './subscriptions';

export type PayMethod = 'upi' | 'qr' | 'card' | 'netbanking' | 'wallet';

export interface Quote {
  plan_id: PlanId;
  period: Period;
  months: number;
  autopay: boolean;
  kind: 'new' | 'renew' | 'upgrade' | 'resume';
  mrp_paise: number;
  base_paise: number;
  launch_off_paise: number;
  period_off_paise: number;
  coupon: { code: string; pct: number | null; off_paise: number; note?: string } | null;
  credit_paise: number;
  amount_paise: number;
  renewal_paise: number | null;
  starts_at: string | null;
  ends_at: string | null;
  renews_on: string | null;
  currency: 'INR';
}

export type CheckoutStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'amount_mismatch';

export interface Checkout {
  checkout_id: string;
  type: 'order' | 'subscription' | 'mandate';
  status: CheckoutStatus;
  plan_id: PlanId;
  period: Period;
  autopay: boolean;
  method: PayMethod | null;
  amount_paise: number;
  expires_at: string;
  quote: Quote;
  razorpay: {
    key_id: string;
    order_id: string | null;
    subscription_id: string | null;
    amount: number;
    currency: 'INR';
    name: string;
    description: string;
    logo_url: string | null;
    prefill: { email: string; contact: string; method: string | null };
  };
  /** Test build without Razorpay keys: the app shows a test payment sheet instead. */
  simulator: boolean;
}

export interface CheckoutState {
  id: string;
  status: CheckoutStatus;
  failure_reason: string | null;
  type: Checkout['type'];
  plan_id: PlanId;
  period: Period;
  autopay: boolean;
  method: PayMethod | null;
  amount_paise: number;
  expires_at: string;
  paid_at: string | null;
  qr: { image_url: string | null; close_by: string } | null;
}

/** What Razorpay's checkout returns on success. */
export interface RazorpayResult {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
}

export interface BillingItem {
  id: string;
  plan_id: PlanId;
  period: Period;
  kind: 'first' | 'renewal' | 'one_time' | 'upgrade';
  amount_paise: number;
  method_display: string | null;
  status: 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed';
  period_end: string | null;
  created_at: string;
}

export type CheckoutInput = {
  plan_id: PlanId;
  period: Period;
  autopay: boolean;
  coupon_code?: string | null;
  method?: PayMethod | null;
};

export const paymentsApi = {
  async quote(input: CheckoutInput) {
    const { data } = await apiClient.post<Quote>('/payments/quote', input);
    return data;
  },
  /** `key` is reused on retries so a flaky network never creates two checkouts. */
  async checkout(input: CheckoutInput, key: string) {
    const { data } = await apiClient.post<Checkout>('/payments/checkout', input, {
      headers: { 'Idempotency-Key': key },
    });
    return data;
  },
  async resumeAutopay(key: string) {
    const { data } = await apiClient.post<Checkout>('/subscriptions/me/resume', undefined, {
      headers: { 'Idempotency-Key': key },
    });
    return data;
  },
  async verify(checkoutId: string, result: RazorpayResult) {
    const { data } = await apiClient.post<CheckoutState & { subscription: Subscription }>(
      '/payments/verify',
      { checkout_id: checkoutId, ...result },
    );
    return data;
  },
  async status(checkoutId: string) {
    const { data } = await apiClient.get<CheckoutState>(`/payments/checkouts/${checkoutId}`);
    return data;
  },
  async pending() {
    const { data } = await apiClient.get<{ checkout: CheckoutState | null }>(
      '/payments/checkouts/pending',
    );
    return data.checkout;
  },
  async abandon(checkoutId: string, reason: 'cancelled' | 'failed', description?: string) {
    const { data } = await apiClient.post<CheckoutState>(
      `/payments/checkouts/${checkoutId}/abandon`,
      { reason, ...(description ? { description: description.slice(0, 300) } : {}) },
    );
    return data;
  },
  async qr(checkoutId: string) {
    const { data } = await apiClient.post<CheckoutState & { simulator: boolean }>('/payments/qr', {
      checkout_id: checkoutId,
    });
    return data;
  },
  async history() {
    const { data } = await apiClient.get<{ items: BillingItem[] }>('/payments/history');
    return data.items;
  },
  /** Simulator builds only: plays Razorpay's sheet. */
  async simulate(
    checkoutId: string,
    outcome: 'success' | 'failure',
    method: 'upi' | 'card' | 'netbanking' | 'wallet',
  ) {
    const { data } = await apiClient.post<Partial<RazorpayResult> & { error?: string }>(
      '/payments/dev/simulate',
      { checkout_id: checkoutId, outcome, method },
    );
    return data;
  },
};
