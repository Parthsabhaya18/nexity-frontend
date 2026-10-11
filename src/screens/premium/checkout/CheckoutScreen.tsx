import { useQuery } from '@tanstack/react-query';
import { Crown, Lock, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { LinkButton } from '@/components/ui/Button';
import { GradientFill } from '@/components/ui/GradientFill';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { day, inr, PERIOD_LABEL, PERIOD_UNIT, PLAN_NAME } from '@/features/payments/format';
import { usePayRunner } from '@/features/payments/usePayRunner';
import { applySubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { paymentsApi } from '@/services/api/payments';
import { radius, spacing, useAppTheme } from '@/theme';
import { uuidv4 } from '@/utils/uuid';

const period = 'monthly' as const;

export function CheckoutScreen({ navigation, route }: ScreenProps<'Checkout'>) {
  const { colors, gradient } = useAppTheme();
  useStatusBar();
  const { planId } = route.params;
  const [autopay, setAutopay] = useState(true);
  const [paying, setPaying] = useState(false);
  const attemptKey = useRef<string | null>(null);
  const runner = usePayRunner();

  // Any change makes a new attempt (a retry of the same inputs reuses the key).
  useEffect(() => {
    attemptKey.current = null;
  }, [autopay]);

  const quoteQ = useQuery({
    queryKey: ['payments', 'quote', planId, period, autopay],
    queryFn: () => paymentsApi.quote({ plan_id: planId, period, autopay, coupon_code: null }),
    retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 2,
  });
  const q = quoteQ.data;
  const blocked = quoteQ.error instanceof ApiError && quoteQ.error.status === 409 ? quoteQ.error : null;

  const pay = async () => {
    if (!q || paying) return;
    setPaying(true);
    attemptKey.current ??= uuidv4();
    try {
      if (q.kind === 'downgrade' || q.amount_paise === 0) {
        const changed = await paymentsApi.confirmChange({
          plan_id: planId,
          period,
          expected_amount_paise: q.amount_paise,
          expected_extra_days: q.extra_days,
        });
        applySubscription(changed.subscription);
        showToast(
          q.kind === 'downgrade'
            ? `${PLAN_NAME[planId]} is active until ${day(changed.quote.ends_at)}.`
            : `${PLAN_NAME[planId]} is active. No payment was due.`,
          'success',
        );
        navigation.navigate('Subscription');
        return;
      }
      const c = await paymentsApi.checkout(
        { plan_id: planId, period, autopay, coupon_code: null, method: null },
        attemptKey.current,
      );
      if (c.autopay_fallback) {
        showToast('AutoPay is not on for this Razorpay account yet. This payment is one-time.', 'info');
      }
      const outcome = await runner.run(c, null, null);
      if (outcome === 'cancelled') attemptKey.current = null;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHECKOUT_IN_PROGRESS') {
        const id = (err.details as { checkout_id?: string } | undefined)?.checkout_id;
        if (id) {
          navigation.replace('PaymentProcessing', { checkoutId: id });
          return;
        }
      }
      showToast(
        err instanceof ApiError
          ? err.isNetworkError
            ? "You're offline. Check your connection and try again."
            : err.message
          : "Couldn't start the payment. Try again.",
        'error',
      );
    } finally {
      setPaying(false);
    }
  };

  const premium = planId === 'premium';
  const PlanIcon = premium ? Crown : Sparkles;
  const unit = PERIOD_UNIT[period];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Checkout" back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.orderHead}>
            <View style={[styles.planIcon, { backgroundColor: colors.primarySoft }]}>
              <PlanIcon size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.orderTitle, { color: colors.text }]}>Nexity {PLAN_NAME[planId]}</Text>
              <Text style={[styles.orderSub, { color: colors.textSecondary }]}>
                {autopay
                  ? 'Monthly plan · renews automatically · cancel anytime'
                  : 'One-time · no auto-renew'}
              </Text>
            </View>
          </View>

          <View style={[styles.autopay, { borderColor: colors.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.autopayTitle, { color: colors.text }]}>Auto-renew with AutoPay</Text>
              <Text style={[styles.autopayText, { color: colors.textSecondary }]}>
                {autopay
                  ? 'No need to pay again every month. Cancel anytime in Subscription.'
                  : "Pay once for 1 month. We'll remind you before it ends."}
              </Text>
            </View>
            <Toggle value={autopay} onChange={setAutopay} accessibilityLabel="Auto-renew with AutoPay" />
          </View>

          {blocked ? (
            <Banner tone="info" message={blocked.message} />
          ) : !q ? (
            quoteQ.isError ? (
              <Banner tone="error" message="Couldn't load the price. Check your connection." />
            ) : (
              <SkeletonLoader variant="rect" height={140} radius={radius.md} />
            )
          ) : (
            <View style={styles.rows}>
              <Row label={`${PLAN_NAME[planId]} × ${q.months} month${q.months > 1 ? 's' : ''}`} value={inr(q.mrp_paise)} />
              {q.launch_off_paise ? <Row label="Launch discount" value={`−${inr(q.launch_off_paise)}`} discount /> : null}
              {q.period_off_paise ? (
                <Row label={`${PERIOD_LABEL[period]} saving`} value={`−${inr(q.period_off_paise)}`} discount />
              ) : null}
              {q.credit_paise ? (
                <Row label="Credit from your current plan" value={`−${inr(q.credit_paise)}`} discount />
              ) : null}
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total today</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>{inr(q.amount_paise)}</Text>
              </View>
              <Text style={[styles.fine, { color: colors.textSecondary }]}>
                {autopay && q.renewal_paise && q.renews_on
                  ? `Then ${inr(q.renewal_paise)} every ${unit} from ${day(q.renews_on)}. `
                  : q.ends_at
                    ? `Active until ${day(q.ends_at)}. `
                    : ''}
                Inclusive of all taxes.
              </Text>
            </View>
          )}
        </View>

        {q?.kind === 'downgrade' ? (
          <View style={[styles.method, { backgroundColor: colors.surface, borderColor: colors.border, padding: 14 }]}>
            <Text style={[styles.methodLabel, { color: colors.text }]}>No payment for this downgrade</Text>
            <Text style={[styles.methodSub, { color: colors.textSecondary }]}>
              {q.consumed_days} days used ({inr(q.consumed_paise)}). Unused credit {inr(q.unused_paise)} becomes{' '}
              {q.extra_days} days on {PLAN_NAME[planId]}, until {day(q.ends_at)}.
              {q.rounding_adjustment_paise
                ? ` Rounding ${q.rounding_adjustment_paise > 0 ? 'adds' : 'removes'} ${inr(Math.abs(q.rounding_adjustment_paise))} of plan value.`
                : ''}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={pay}
          disabled={!q || paying || !!blocked}
          accessibilityRole="button"
          accessibilityState={{ disabled: !q || paying || !!blocked, busy: paying }}
          style={({ pressed }) => [
            styles.payBtn,
            !premium && { backgroundColor: colors.button },
            (!q || !!blocked) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {premium ? <GradientFill colors={gradient} radius={radius.lg} /> : null}
          <Text style={[styles.payText, { color: colors.onButton }]}>
            {paying
              ? 'Please wait…'
              : q?.kind === 'downgrade' || q?.amount_paise === 0
                ? 'Confirm plan change'
                : q
                  ? `Pay ${inr(q.amount_paise)}`
                  : 'Pay'}
          </Text>
        </Pressable>
        <View style={styles.secure}>
          <Lock size={13} color={colors.textSecondary} />
          <Text style={[styles.secureText, { color: colors.textSecondary }]}>
            Secured by Razorpay · 256-bit encryption · We never see your card or bank details.
          </Text>
        </View>
        <View style={styles.links}>
          <LinkButton title="Terms" onPress={() => Linking.openURL('https://nexity.com/terms')} />
          <LinkButton title="Refund policy" onPress={() => Linking.openURL('https://nexity.com/refunds')} />
          <LinkButton title="Privacy" onPress={() => Linking.openURL('https://nexity.com/privacy')} />
        </View>
      </ScrollView>
      {runner.element}
    </SafeAreaView>
  );
}

function Row({ label, value, discount }: { label: string; value: string; discount?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: discount ? colors.success : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 14 },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderTitle: { fontSize: 17, fontWeight: '800' },
  orderSub: { fontSize: 12.5, marginTop: 2 },
  autopay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  autopayTitle: { fontSize: 14.5, fontWeight: '700' },
  autopayText: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rows: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 13.5, flex: 1 },
  rowValue: { fontSize: 13.5, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 15.5, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  fine: { fontSize: 12, lineHeight: 17 },
  methods: { gap: 8 },
  method: { borderWidth: 1.5, borderRadius: radius.md, overflow: 'hidden' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 60 },
  methodIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { fontSize: 14.5, fontWeight: '700' },
  methodSub: { fontSize: 12, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  chip: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  qrNote: { fontSize: 12, textAlign: 'center' },
  payBtn: {
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  payText: { fontSize: 16.5, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  secure: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 8 },
  secureText: { flex: 1, fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 4 },
});
