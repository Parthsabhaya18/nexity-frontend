import { classifyRazorpayError } from '../src/features/payments/razorpayError';

describe('Razorpay errors', () => {
  it('treats an Android back-press as a cancel', () => {
    expect(classifyRazorpayError({ code: 0, description: 'Payment cancelled by user' }).kind).toBe(
      'cancelled',
    );
  });

  it('treats an iOS closed sheet as a cancel', () => {
    expect(
      classifyRazorpayError({ code: 2, description: 'Payment processing cancelled by user' }).kind,
    ).toBe('cancelled');
  });

  it('keeps a network or bank failure as a failure on either phone', () => {
    expect(classifyRazorpayError({ code: 2, description: 'Network error' })).toEqual({
      kind: 'failed',
      description: 'Network error',
    });
    expect(
      classifyRazorpayError({
        code: 0,
        description: JSON.stringify({ error: { reason: 'payment_failed', description: 'Bank declined' } }),
      }),
    ).toEqual({ kind: 'failed', description: 'Bank declined' });
  });
});
