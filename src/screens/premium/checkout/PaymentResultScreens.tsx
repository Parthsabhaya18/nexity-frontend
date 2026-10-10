import { useQuery } from '@tanstack/react-query';
import { Check, Hourglass, Info, X } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { BackHandler, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fireworks } from '@/components/celebration/Celebration';
import { Button, LinkButton } from '@/components/ui/Button';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { showToast } from '@/components/ui/Toast';
import { day, inr, PERIOD_UNIT, PLAN_NAME } from '@/features/payments/format';
import { takeReturnSection } from '@/features/payments/returnTo';
import { usePlans, useSubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { paymentsApi } from '@/services/api/payments';
import { radius, spacing, useAppTheme } from '@/theme';

const useCheckoutState = (checkoutId: string) =>
  useQuery({
    queryKey: ['payments', 'checkout', checkoutId],
    queryFn: () => paymentsApi.status(checkoutId),
  });

/* ---------- PurchaseSuccess ---------- */

export function PurchaseSuccessScreen({ navigation, route }: ScreenProps<'PurchaseSuccess'>) {
  const { colors, gradient } = useAppTheme();
  useStatusBar();
  const { checkoutId } = route.params;
  const c = useCheckoutState(checkoutId).data;
  const sub = useSubscription().data;
  const plans = usePlans().data;
  const section = useMemo(() => takeReturnSection(), []);
  const planId = c?.plan_id ?? (sub?.plan !== 'free' ? sub?.plan : undefined);
  const plan = plans?.data.find(p => p.id === planId);
  const mandate = c?.type === 'mandate';

  useEffect(() => {
    showToast(mandate ? 'AutoPay is on' : 'Payment successful', 'success');
  }, [mandate]);

  const goPremium = () => {
    navigation.popTo('Main', { screen: 'Premium', params: section ? { section } : undefined });
  };

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      goPremium();
      return true;
    });
    return () => s.remove();
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Fireworks colors={[...gradient, colors.success]} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.bigIcon, { backgroundColor: colors.success }]}>
          <Check size={48} color={colors.onButton} strokeWidth={3} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.success }]}>
          {mandate ? 'AutoPay approved' : 'Payment successful'}
        </Text>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {planId ? `You're on ${PLAN_NAME[planId]}` : 'Thank you!'}
        </Text>
        {sub?.current_period_end ? (
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {sub.billing?.autopay
              ? `Renews automatically on ${day(sub.current_period_end)}${sub.billing.price_paise ? ` for ${inr(sub.billing.price_paise)}` : ''}.`
              : `Your plan is active until ${day(sub.current_period_end)}.`}
            {c && !mandate ? ` Paid ${inr(c.amount_paise)}.` : ''}
          </Text>
        ) : null}
        {plan ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {plan.features.map(f => (
              <View key={f} style={styles.feature}>
                <Check size={16} color={colors.success} strokeWidth={2.6} />
                <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button
            title={
              section === 'crush'
                ? 'Continue to Secret Crush'
                : section === 'messages'
                  ? 'Continue to Secret Messages'
                  : 'Go to Premium'
            }
            onPress={goPremium}
          />
          <Button title="View subscription" variant="ghost" onPress={() => navigation.replace('Subscription')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- PaymentFailed ---------- */

export function PaymentFailedScreen({ navigation, route }: ScreenProps<'PaymentFailed'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const { checkoutId } = route.params;
  const c = useCheckoutState(checkoutId).data;
  const mismatch = c?.status === 'amount_mismatch';
  const reason =
    c?.failure_reason && !['closed', 'replaced', 'provider_error', 'amount_mismatch'].includes(c.failure_reason)
      ? c.failure_reason
      : null;

  const retry = () => {
    if (!c || c.type === 'mandate') {
      navigation.replace('Subscription');
      return;
    }
    navigation.replace('Checkout', { planId: c.plan_id as 'plus' | 'premium', period: c.period });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.bigIcon, { backgroundColor: colors.dangerSoft }]}>
          <X size={44} color={colors.danger} strokeWidth={3} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Payment failed
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {mismatch
            ? "The amount paid didn't match the plan price, so we're refunding it in full. Your plan was not changed."
            : `${reason ? `${reason}. ` : ''}Your payment${c ? ` of ${inr(c.amount_paise)}` : ''} didn't go through. `}
          {mismatch ? null : <Text style={styles.bold}>No money was deducted.</Text>}
          {mismatch ? null : ' If money was deducted, it will be refunded automatically within 5–7 working days.'}
        </Text>
        <View style={[styles.tip, { backgroundColor: colors.surfaceAlt }]}>
          <Info size={16} color={colors.textSecondary} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            Check your balance or UPI limit, or try a different payment method.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Try again" onPress={retry} />
          <Button title="Back to plans" variant="secondary" onPress={() => navigation.replace('Plans')} />
          <View style={styles.center}>
            <LinkButton
              title="Contact support"
              onPress={() =>
                Linking.openURL(
                  `mailto:support@nexity.com?subject=${encodeURIComponent('Payments & subscription')}&body=${encodeURIComponent(`Checkout id: ${checkoutId}\n\n`)}`,
                ).catch(() => showToast('Email support@nexity.com', 'info'))
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- PaymentPending ---------- */

export function PaymentPendingScreen({ navigation, route }: ScreenProps<'PaymentPending'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const { checkoutId } = route.params;
  const c = useCheckoutState(checkoutId).data;
  const unit = c ? PERIOD_UNIT[c.period] : null;

  const ok = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Main');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.bigIcon, { backgroundColor: colors.primarySoft }]}>
          <Hourglass size={42} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Payment is being confirmed
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          Your bank is taking longer than usual. We'll unlock your plan as soon as it's confirmed —
          you'll get a notification. <Text style={styles.bold}>You don't need to pay again.</Text>
        </Text>
        {c ? (
          <Text style={[styles.small, { color: colors.textSecondary }]}>
            {PLAN_NAME[c.plan_id]} · {inr(c.amount_paise)}
            {unit ? ` / ${unit}` : ''}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button title="OK" onPress={ok} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { alignItems: 'center', paddingTop: 4 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: spacing.lg,
    gap: 14,
  },
  bigIcon: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  eyebrow: { fontSize: 13, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  small: { fontSize: 13, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 8 },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tip: { flexDirection: 'row', gap: 8, borderRadius: radius.md, padding: 12, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actions: { gap: 10, marginTop: 8 },
});
