import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlaskConical } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, LinkButton } from '@/components/ui/Button';
import type { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@/services/api/client';
import { type Checkout, type PayMethod, paymentsApi } from '@/services/api/payments';
import { radius, spacing, useAppTheme } from '@/theme';

import { inr } from './format';
import { type OpenResult, openRazorpay, stashResult, type UpiApp } from './razorpay';

const UPI_APP_LABEL: Record<UpiApp, string> = {
  google_pay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  bhim: 'BHIM',
  upi_id: 'UPI ID',
};

export function methodLabel(method: PayMethod | null, upiApp: UpiApp | null) {
  switch (method) {
    case 'upi':
      return upiApp ? `UPI · ${UPI_APP_LABEL[upiApp]}` : 'UPI';
    case 'card':
      return 'Debit / credit card';
    case 'netbanking':
      return 'Net banking';
    case 'wallet':
      return 'Wallet';
    case 'qr':
      return 'Scan QR';
    default:
      return 'UPI';
  }
}

type SimRequest = {
  checkout: Checkout;
  method: PayMethod | null;
  upiApp: UpiApp | null;
  resolve: (r: OpenResult) => void;
};

/**
 * Opens the payment sheet for a server-created checkout and moves to Processing / Failed.
 * Test builds without Razorpay keys get a test sheet that plays Razorpay's part.
 */
export function usePayRunner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const [sim, setSim] = useState<SimRequest | null>(null);
  const [simBusy, setSimBusy] = useState<'success' | 'failure' | null>(null);
  const settled = useRef(false);

  const run = useCallback(
    async (c: Checkout, method: PayMethod | null, upiApp: UpiApp | null) => {
      const res: OpenResult = c.simulator
        ? await new Promise<OpenResult>(resolve => {
            settled.current = false;
            setSim({ checkout: c, method, upiApp, resolve });
          })
        : await openRazorpay(c, { color: colors.primary, method, upiApp });

      if (res.kind === 'success' || res.kind === 'unknown') {
        if (res.kind === 'success') stashResult(c.checkout_id, res.result);
        navigation.replace('PaymentProcessing', { checkoutId: c.checkout_id });
        return res.kind;
      }
      if (res.kind === 'failed') {
        await paymentsApi.abandon(c.checkout_id, 'failed', res.description).catch(() => {});
        navigation.replace('PaymentFailed', { checkoutId: c.checkout_id });
        return res.kind;
      }
      await paymentsApi.abandon(c.checkout_id, 'cancelled').catch(() => {});
      return res.kind;
    },
    [colors.primary, navigation],
  );

  const finish = (r: OpenResult) => {
    if (!sim || settled.current) return;
    settled.current = true;
    sim.resolve(r);
    setSim(null);
    setSimBusy(null);
  };

  const simulate = async (outcome: 'success' | 'failure') => {
    if (!sim) return;
    setSimBusy(outcome);
    const m = sim.method && sim.method !== 'qr' ? sim.method : 'upi';
    try {
      const res = await paymentsApi.simulate(sim.checkout.checkout_id, outcome, m);
      if (res.razorpay_payment_id && res.razorpay_signature) {
        finish({
          kind: 'success',
          result: {
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature: res.razorpay_signature,
            ...(res.razorpay_order_id ? { razorpay_order_id: res.razorpay_order_id } : {}),
            ...(res.razorpay_subscription_id
              ? { razorpay_subscription_id: res.razorpay_subscription_id }
              : {}),
          },
        });
      } else {
        finish({ kind: 'failed', description: res.error ?? 'Payment failed' });
      }
    } catch (err) {
      finish({
        kind: 'failed',
        description: err instanceof ApiError ? err.message : 'Payment failed',
      });
    }
  };

  const c = sim?.checkout;
  const mandate = c?.type === 'mandate';
  const element = (
    <BottomSheet visible={!!sim} onClose={() => (simBusy ? undefined : finish({ kind: 'cancelled' }))}>
      {c ? (
        <View style={styles.sheet}>
          <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
            <FlaskConical size={14} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Razorpay · Test mode</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {c.razorpay.description}
          </Text>
          <Text style={[styles.amount, { color: colors.text }]}>
            {mandate ? inr(0) : inr(c.amount_paise)}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {mandate
              ? `Approve AutoPay · ${inr(c.quote.renewal_paise ?? 0)} from ${c.quote.starts_at?.slice(0, 10) ?? ''}`
              : `${methodLabel(sim.method, sim.upiApp)}${c.autopay ? ' · AutoPay' : ''}`}
          </Text>
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              No real money moves in this test build. Add Razorpay keys on the server to open the
              real Razorpay sheet with Google Pay, PhonePe, Paytm, cards and net banking.
            </Text>
          </View>
          <Button
            title={mandate ? 'Approve AutoPay' : `Pay ${inr(c.amount_paise)}`}
            loading={simBusy === 'success'}
            disabled={!!simBusy}
            onPress={() => simulate('success')}
          />
          <Button
            title="Simulate a declined payment"
            variant="secondary"
            loading={simBusy === 'failure'}
            disabled={!!simBusy}
            onPress={() => simulate('failure')}
          />
          <View style={styles.cancel}>
            <LinkButton
              title="Cancel"
              disabled={!!simBusy}
              onPress={() => finish({ kind: 'cancelled' })}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );

  return { run, element };
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 12 },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  amount: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13.5, textAlign: 'center', marginTop: -6 },
  note: { borderRadius: radius.md, padding: 12 },
  noteText: { fontSize: 12.5, lineHeight: 18 },
  cancel: { alignItems: 'center', paddingVertical: 4 },
});
