export type RazorpayFailure = { kind: 'cancelled' } | { kind: 'failed'; description: string };

/**
 * Android reports a closed sheet as code 0. iOS reports it as code 2.
 * A bare 0 or 2 is a cancel only when the text does not describe another failure.
 */
export function classifyRazorpayError(err: unknown): RazorpayFailure {
  const e = (err ?? {}) as { code?: number | string; description?: string };
  let description = e.description ?? '';
  let reason = '';
  try {
    const parsed = JSON.parse(description) as {
      error?: { description?: string; reason?: string };
    };
    description = parsed.error?.description ?? description;
    reason = parsed.error?.reason ?? '';
  } catch {
    // Plain text from the native SDK.
  }
  const code = typeof e.code === 'string' ? Number(e.code) : e.code;
  const text = `${reason} ${description}`;
  const saysCancel = reason === 'payment_cancelled' || /cancel|closed by user|dismiss/i.test(text);
  const saysOtherFailure = /network|timeout|bank|declin|invalid|tls/i.test(text);
  if (saysCancel || ((code === 0 || code === 2) && !saysOtherFailure)) {
    return { kind: 'cancelled' };
  }
  return { kind: 'failed', description: description || 'Payment failed' };
}
