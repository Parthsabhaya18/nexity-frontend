import { useQuery } from '@tanstack/react-query';
import { CreditCard, Crown, Receipt, Sparkles, User } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { useCrushSummary } from '@/features/crush/crushQueries';
import { day, inr, PERIOD_LABEL, PERIOD_UNIT, PLAN_NAME } from '@/features/payments/format';
import { usePayRunner } from '@/features/payments/usePayRunner';
import { applySubscription, usePlans, useSubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { paymentsApi } from '@/services/api/payments';
import { subscriptionsApi } from '@/services/api/subscriptions';
import { radius, spacing, useAppTheme } from '@/theme';
import { uuidv4 } from '@/utils/uuid';

export function SubscriptionScreen({ navigation }: ScreenProps<'Subscription'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const subQ = useSubscription();
  const sub = subQ.data;
  const plans = usePlans().data;
  const crush = useCrushSummary().data;
  const historyQ = useQuery({ queryKey: ['payments', 'history'], queryFn: paymentsApi.history });
  const runner = usePayRunner();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<'cancel' | 'resume' | null>(null);

  const paid = !!sub && sub.status === 'active' && sub.plan !== 'free';
  const b = sub?.billing ?? null;
  const razorpay = b?.source === 'razorpay';
  const end = sub?.current_period_end ?? null;
  const planName = sub ? PLAN_NAME[sub.plan] : '';
  const Icon = sub?.plan === 'premium' ? Crown : sub?.plan === 'plus' ? Sparkles : User;
  const canBuy = plans?.checkout_available ?? false;

  const chip = !paid
    ? null
    : b?.status === 'in_grace'
      ? { text: 'Payment due', bg: colors.dangerSoft, fg: colors.danger }
      : !razorpay
        ? { text: 'Test plan', bg: colors.surfaceAlt, fg: colors.textSecondary }
        : b?.autopay
          ? { text: 'Active', bg: colors.successSoft, fg: colors.success }
          : { text: 'Ends soon', bg: colors.primarySoft, fg: colors.primary };

  const cancel = async () => {
    setBusy('cancel');
    try {
      applySubscription(await subscriptionsApi.cancelAutopay());
      setConfirmCancel(false);
      showToast(`AutoPay off. ${planName} stays active until ${day(end)}.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't cancel AutoPay.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    setBusy('resume');
    try {
      const c = await paymentsApi.resumeAutopay(uuidv4());
      await runner.run(c, null, null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't turn on AutoPay.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const renew = () => {
    if (!sub || sub.plan === 'free') return;
    navigation.navigate('Checkout', { planId: sub.plan, period: b?.period ?? 'monthly' });
  };

  const priceText = !paid
    ? null
    : !razorpay
      ? 'Free (test plan)'
      : b?.price_paise && b.period
        ? `${inr(b.price_paise)} / ${PERIOD_UNIT[b.period]}`
        : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Subscription" back />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={subQ.isRefetching}
            onRefresh={() => {
              subQ.refetch();
              historyQ.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {!sub ? (
          <SkeletonLoader variant="rect" height={200} radius={radius.lg} />
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: paid ? colors.primary : colors.border }]}>
            <View style={styles.top}>
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Icon size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Current plan</Text>
                <Text style={[styles.planName, { color: colors.text }]} accessibilityRole="header">
                  {planName}
                </Text>
              </View>
              {chip ? (
                <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                  <Text style={[styles.chipText, { color: chip.fg }]}>{chip.text}</Text>
                </View>
              ) : null}
            </View>
            {paid ? (
              <View style={styles.rows}>
                <Row label={b?.autopay ? 'Renews on' : 'Active until'} value={day(end)} />
                {b?.period ? <Row label="Billing" value={PERIOD_LABEL[b.period]} /> : null}
                {priceText ? <Row label="Price" value={priceText} /> : null}
                {razorpay ? (
                  <Row
                    label="Pays with"
                    value={`${b?.autopay ? 'AutoPay · ' : ''}${b?.method_display ?? '—'}`}
                  />
                ) : null}
                {b?.autopay && b.next_charge_at && b.price_paise ? (
                  <Row label="Next charge" value={`${inr(b.price_paise)} on ${day(b.next_charge_at)}`} />
                ) : null}
                {razorpay && !b?.autopay ? (
                  <Text style={[styles.note, { color: colors.textSecondary }]}>
                    Doesn't renew. We'll remind you before it ends.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.note, { color: colors.textSecondary }]}>
                You're on the Free plan. Upgrade to send and read Secret Messages, add Secret Crushes and see
                who was near you.
              </Text>
            )}
          </View>
        )}

        {b?.status === 'in_grace' ? (
          <Banner tone="error" message="We couldn't renew your plan. Pay now to keep Secret features." />
        ) : null}

        {paid && sub ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>This month</Text>
            <View style={styles.usage}>
              <Usage
                value={sub.usage.secret_messages_left == null ? '∞' : String(sub.usage.secret_messages_left)}
                label="Secret Messages left"
              />
              <Usage value={crush ? String(crush.spots.left) : '—'} label="Crush spots left" />
              <Usage value={sub.limits.nearby ? '✓' : '—'} label="Nearby hints" />
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {sub?.plan !== 'premium' ? (
            <Button
              title={paid ? 'Upgrade to Premium' : 'See plans'}
              onPress={() =>
                paid && canBuy ? navigation.navigate('Checkout', { planId: 'premium' }) : navigation.navigate('Plans')
              }
            />
          ) : (
            <Button title="View plans" variant="secondary" onPress={() => navigation.navigate('Plans')} />
          )}
          {paid && razorpay && canBuy ? (
            b?.status === 'in_grace' ? (
              <Button title="Pay now" onPress={renew} />
            ) : b?.autopay ? (
              <Button title="Cancel AutoPay" variant="ghost" onPress={() => setConfirmCancel(true)} />
            ) : (
              <>
                <Button
                  title="Turn AutoPay back on"
                  variant="secondary"
                  loading={busy === 'resume'}
                  disabled={!!busy}
                  onPress={resume}
                />
                <Button title="Renew now" variant="ghost" onPress={renew} />
              </>
            )
          ) : null}
        </View>

        <Text style={[styles.section, { color: colors.text }]} accessibilityRole="header">
          Billing history
        </Text>
        {historyQ.isPending ? (
          <SkeletonLoader variant="rect" height={120} radius={radius.lg} />
        ) : !historyQ.data?.length ? (
          <EmptyState
            icon={<Receipt size={30} color={colors.primary} />}
            title="No payments yet"
            text="Your receipts will appear here."
          />
        ) : (
          <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {historyQ.data.map((item, i) => (
              <View
                key={item.id}
                style={[styles.bill, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              >
                <CreditCard size={18} color={colors.textSecondary} />
                <View style={styles.flex}>
                  <Text style={[styles.billTitle, { color: colors.text }]}>
                    {PLAN_NAME[item.plan_id]} · {PERIOD_LABEL[item.period]}
                    {item.kind === 'renewal' ? ' · renewal' : item.kind === 'upgrade' ? ' · upgrade' : ''}
                  </Text>
                  <Text style={[styles.billSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {day(item.created_at)}
                    {item.method_display ? ` · ${item.method_display}` : ''}
                  </Text>
                </View>
                <View style={styles.billRight}>
                  <Text style={[styles.billAmount, { color: colors.text }]}>{inr(item.amount_paise)}</Text>
                  <Text
                    style={[
                      styles.billStatus,
                      { color: item.status === 'paid' ? colors.success : item.status === 'failed' ? colors.danger : colors.textSecondary },
                    ]}
                  >
                    {item.status === 'paid' ? 'Paid' : item.status === 'failed' ? 'Failed' : 'Refunded'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel AutoPay?"
        message={`You'll keep ${planName} until ${day(end)}. After that you'll move to Free and lose access to Secret features.`}
        confirmLabel="Cancel AutoPay"
        cancelLabel="Keep AutoPay"
        destructive
        loading={busy === 'cancel'}
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
      {runner.element}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Usage({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.usageItem}>
      <Text style={[styles.usageValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: 12 },
  list: { paddingVertical: 4, gap: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  planName: { fontSize: 22, fontWeight: '800' },
  chip: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '800' },
  rows: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 13.5 },
  rowValue: { fontSize: 13.5, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  note: { fontSize: 13.5, lineHeight: 19 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  usage: { flexDirection: 'row', gap: 8 },
  usageItem: { flex: 1, alignItems: 'center', gap: 2 },
  usageValue: { fontSize: 22, fontWeight: '800' },
  usageLabel: { fontSize: 11.5, textAlign: 'center' },
  actions: { gap: 8 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  bill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  billTitle: { fontSize: 14, fontWeight: '700' },
  billSub: { fontSize: 12, marginTop: 2 },
  billRight: { alignItems: 'flex-end' },
  billAmount: { fontSize: 14.5, fontWeight: '800' },
  billStatus: { fontSize: 11.5, fontWeight: '800', marginTop: 2 },
});
