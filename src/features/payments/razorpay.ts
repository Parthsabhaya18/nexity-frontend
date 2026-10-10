import RazorpayCheckout from 'react-native-razorpay';

import type { Checkout, PayMethod, RazorpayResult } from '@/services/api/payments';

import { classifyRazorpayError } from './razorpayError';

export type UpiApp = 'google_pay' | 'phonepe' | 'paytm' | 'bhim' | 'upi_id';

export type OpenResult =
  | { kind: 'success'; result: RazorpayResult }
  | { kind: 'unknown' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; description: string };

/** Puts the method picked on our Checkout screen first in Razorpay's sheet; the rest stay available. */
function displayConfig(method: PayMethod | null, upiApp: UpiApp | null) {
  let instrument: Record<string, unknown> | null = null;
  let name = 'Pay with UPI';
  if (method === 'upi') {
    instrument =
      upiApp && upiApp !== 'upi_id'
        ? { method: 'upi', flows: ['intent'], apps: [upiApp] }
        : { method: 'upi', flows: upiApp === 'upi_id' ? ['collect'] : ['intent', 'collect', 'qr'] };
  } else if (method === 'card') {
    instrument = { method: 'card' };
    name = 'Pay with card';
  } else if (method === 'netbanking') {
    instrument = { method: 'netbanking' };
    name = 'Pay with net banking';
  } else if (method === 'wallet') {
    instrument = { method: 'wallet' };
    name = 'Pay with wallet';
  }
  if (!instrument) return undefined;
  return {
    display: {
      blocks: { preferred: { name, instruments: [instrument] } },
      sequence: ['block.preferred'],
      preferences: { show_default_blocks: true },
    },
  };
}

/** Reads Razorpay's error payload (its `description` is often a JSON string). */
function parseError(err: unknown): OpenResult {
  return classifyRazorpayError(err);
}

/** Opens Razorpay Standard Checkout for a server-created order / subscription. */
export async function openRazorpay(
  c: Checkout,
  opts: { color: string; method: PayMethod | null; upiApp: UpiApp | null },
): Promise<OpenResult> {
  const r = c.razorpay;
  const options = {
    key: r.key_id,
    name: r.name,
    description: r.description,
    ...(r.logo_url ? { image: r.logo_url } : {}),
    currency: 'INR',
    ...(r.subscription_id
      ? { subscription_id: r.subscription_id, recurring: true }
      : { order_id: r.order_id ?? undefined, amount: r.amount }),
    amount: r.amount,
    prefill: {
      email: r.prefill.email,
      contact: r.prefill.contact,
      ...(opts.method && opts.method !== 'qr' ? { method: opts.method } : {}),
    },
    notes: { checkout_id: c.checkout_id },
    theme: { color: opts.color },
    retry: { enabled: true, max_count: 3 },
    timeout: 900,
    ...(displayConfig(opts.method, opts.upiApp) ? { config: displayConfig(opts.method, opts.upiApp) } : {}),
  };
  try {
    const data = (await RazorpayCheckout.open(options)) as Partial<RazorpayResult>;
    if (!data.razorpay_payment_id || !data.razorpay_signature) {
      return { kind: 'unknown' };
    }
    return {
      kind: 'success',
      result: {
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        ...(data.razorpay_order_id ? { razorpay_order_id: data.razorpay_order_id } : {}),
        ...(data.razorpay_subscription_id
          ? { razorpay_subscription_id: data.razorpay_subscription_id }
          : {}),
      },
    };
  } catch (err) {
    return parseError(err);
  }
}

/** Results waiting for `PaymentProcessing` to verify (params carry ids only). */
const pendingResults = new Map<string, RazorpayResult>();

export function stashResult(checkoutId: string, result: RazorpayResult) {
  pendingResults.set(checkoutId, result);
}

export function takeResult(checkoutId: string) {
  const r = pendingResults.get(checkoutId);
  pendingResults.delete(checkoutId);
  return r;
}
