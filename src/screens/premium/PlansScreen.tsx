import {
  Check,
  CloudOff,
  Crown,
  Heart,
  Info,
  Lock,
  Mail,
  MapPin,
  Repeat,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientFill } from '@/components/ui/GradientFill';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { day, inr } from '@/features/payments/format';
import { setReturnSection } from '@/features/payments/returnTo';
import { applySubscription, usePlans, useSubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { type Plan, type PlanId, type PlansPage, subscriptionsApi } from '@/services/api/subscriptions';
import { radius, spacing, useAppTheme } from '@/theme';

const GLYPHS = {
  user: User,
  sparkles: Sparkles,
  crown: Crown,
  send: Send,
  mail: Mail,
  heart: Heart,
  'map-pin': MapPin,
  repeat: Repeat,
  x: X,
  'shield-check': ShieldCheck,
  info: Info,
  lock: Lock,
  check: Check,
} as const;

function Glyph({ name, size, color, strokeWidth }: { name: string; size: number; color: string; strokeWidth?: number }) {
  const Icon = GLYPHS[name as keyof typeof GLYPHS] ?? Info;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

export function PlansScreen({ navigation, route }: ScreenProps<'Plans'>) {
  const { colors, gradient } = useAppTheme();
  useStatusBar();
  const reason = route.params?.reason;
  const plansQ = usePlans();
  const subQ = useSubscription();
  const current = subQ.data;
  const [busy, setBusy] = useState<PlanId | null>(null);

  useEffect(() => {
    setReturnSection(reason === 'crush' ? 'crush' : reason ? 'messages' : null);
  }, [reason]);

  const devSwitch = async (plan: PlanId) => {
    setBusy(plan);
    try {
      applySubscription(await subscriptionsApi.devActivate(plan));
      showToast(plan === 'free' ? "You're on Free" : `${plan === 'plus' ? 'Plus' : 'Premium'} is active (test)`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't change plan.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const data = plansQ.data;
  const page = data?.page;
  const plans = data?.data ?? [];
  const byId = Object.fromEntries(plans.map(p => [p.id, p])) as Record<string, Plan>;
  const myPlan = current?.plan ?? 'free';
  const myRank = byId[myPlan]?.rank ?? 0;
  const paid = current?.status === 'active' && myPlan !== 'free';
  const r = reason && page ? page.reasons[reason] : null;

  const cta = (plan: Plan) => {
    const isCurrent = plan.id === myPlan;
    if (isCurrent) {
      return plan.id === 'free' ? (
        <Button title="Your current plan" variant="secondary" disabled onPress={() => {}} style={styles.button} />
      ) : (
        <Button
          title="Manage subscription"
          variant="secondary"
          onPress={() => navigation.navigate('Subscription')}
          style={styles.button}
        />
      );
    }
    if (plan.rank < myRank) {
      return (
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {plan.id === 'free' ? 'Included in every plan' : `Included in ${byId[myPlan]?.name ?? 'your plan'}`}
        </Text>
      );
    }
    if (!data?.checkout_available) {
      return (
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {page?.checkout_unavailable_note}
        </Text>
      );
    }
    const featured = Boolean(plan.highlight_label);
    const label = plan.cta_label || `Upgrade to ${plan.name}`;
    return (
      <Pressable
        onPress={() => navigation.navigate('Checkout', { planId: plan.id as 'plus' | 'premium' })}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.payBtn,
          !featured && { backgroundColor: colors.button },
          pressed && styles.pressed,
        ]}
      >
        {featured ? <GradientFill colors={gradient} radius={radius.lg} /> : null}
        <Text style={[styles.payBtnText, { color: colors.onButton }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Plans" back />
      <ScrollView contentContainerStyle={styles.content}>
        {plansQ.isPending ? (
          <View style={styles.head}>
            <SkeletonLoader variant="line" width="70%" height={22} style={styles.centerBone} />
            <SkeletonLoader variant="line" width="86%" height={14} style={styles.centerBone} />
          </View>
        ) : r ? (
          <View style={[styles.reason, { backgroundColor: colors.primarySoft }]}>
            <View style={[styles.reasonIcon, { backgroundColor: colors.surface }]}>
              <Glyph name={r.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.reasonTitle, { color: colors.text }]} accessibilityRole="header">
                {r.title}
              </Text>
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{r.text}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {page?.title}
            </Text>
            {page?.subtitle ? (
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{page.subtitle}</Text>
            ) : null}
          </View>
        )}

        {current ? (
          <View style={[styles.currentLine, { backgroundColor: colors.surfaceAlt }]}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={[styles.currentText, { color: colors.text }]}>
              {page?.current_prefix ?? "You're on"}{' '}
              <Text style={styles.bold}>{byId[myPlan]?.name ?? 'Free'}</Text>
              {paid && current.current_period_end
                ? ` · ${current.billing?.autopay ? 'renews' : 'active until'} ${day(current.current_period_end)}`
                : ''}
            </Text>
          </View>
        ) : null}

        {plansQ.isPending ? (
          [0, 1, 2].map(i => <PlanSkeleton key={i} />)
        ) : plansQ.isError || !data || !page ? (
          <EmptyState
            icon={<CloudOff size={34} color={colors.primary} />}
            title="Couldn't load plans"
            text="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => plansQ.refetch()}
          />
        ) : (
          <>
            {plans.map(plan => {
              const isCurrent = plan.id === myPlan;
              const featured = Boolean(plan.highlight_label);
              const monthly = plan.pricing.monthly.amount_paise;
              const save = plan.mrp_paise > monthly && monthly > 0 ? Math.round((1 - monthly / plan.mrp_paise) * 100) : 0;
              return (
                <View
                  key={plan.id}
                  accessibilityLabel={`${plan.name} plan`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isCurrent || featured ? colors.primary : colors.border,
                      borderWidth: featured ? 2 : 1.5,
                    },
                  ]}
                >
                  {featured ? (
                    <View style={[styles.ribbon, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.ribbonText, { color: colors.onButton }]}>{plan.highlight_label}</Text>
                    </View>
                  ) : null}
                  <View style={styles.cardHead}>
                    <View style={[styles.planIcon, { backgroundColor: colors.primarySoft }]}>
                      <Glyph name={plan.icon} size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                    {isCurrent ? (
                      <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
                        <Text style={[styles.badgeText, { color: colors.success }]}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.desc, { color: colors.textSecondary }]}>{plan.description}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: colors.text }]}>{inr(monthly)}</Text>
                    <Text style={[styles.per, { color: colors.textSecondary }]}>
                      {monthly ? '/month' : 'forever'}
                    </Text>
                    {save ? (
                      <>
                        <Text style={[styles.mrp, { color: colors.textSecondary }]}>{inr(plan.mrp_paise)}</Text>
                        <View style={[styles.save, { backgroundColor: colors.successSoft }]}>
                          <Text style={[styles.saveText, { color: colors.success }]}>Save {save}%</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                  {monthly ? (
                    <Text style={[styles.yearly, { color: colors.textSecondary }]}>
                      or {inr(plan.pricing.yearly.per_month_paise)}/mo billed yearly (save {plan.pricing.yearly.save_pct}%)
                    </Text>
                  ) : null}
                  {plan.features.map(f => (
                    <View key={f} style={styles.feature}>
                      <Check size={16} color={colors.success} strokeWidth={2.6} />
                      <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                    </View>
                  ))}
                  {(plan.missing_features ?? []).map(f => (
                    <View key={f} style={styles.feature}>
                      <X size={16} color={colors.textSecondary} strokeWidth={2.4} />
                      <Text style={[styles.featureText, styles.off, { color: colors.textSecondary }]}>{f}</Text>
                    </View>
                  ))}
                  {cta(plan)}
                </View>
              );
            })}

            <Compare page={page} plans={plans} />

            <View style={styles.trust}>
              {page.trust.map(t => (
                <View key={t.text} style={styles.trustItem}>
                  <Glyph name={t.icon} size={15} color={colors.textSecondary} />
                  <Text style={[styles.trustText, { color: colors.textSecondary }]}>{t.text}</Text>
                </View>
              ))}
            </View>

            {data.dev_switch ? (
              <View style={[styles.dev, { borderColor: colors.border }]}>
                <View style={styles.devHead}>
                  <Lock size={14} color={colors.textSecondary} />
                  <Text style={[styles.devTitle, { color: colors.textSecondary }]}>
                    Test tools · switch plan without paying
                  </Text>
                </View>
                <View style={styles.devRow}>
                  {plans.map(p => (
                    <Button
                      key={p.id}
                      title={p.name}
                      variant="secondary"
                      loading={busy === p.id}
                      disabled={!!busy || myPlan === p.id}
                      onPress={() => devSwitch(p.id)}
                      style={styles.devBtn}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLabel="Loading plan"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1.5 }]}
    >
      <View style={styles.cardHead}>
        <SkeletonLoader variant="circle" size={36} />
        <SkeletonLoader variant="line" width={110} height={18} />
      </View>
      <SkeletonLoader variant="line" lines={2} height={12} />
      <SkeletonLoader variant="line" width={150} height={26} />
      <SkeletonLoader variant="line" lines={4} height={14} />
      <SkeletonLoader variant="rect" height={52} radius={radius.lg} />
    </View>
  );
}

function Compare({ page, plans }: { page: PlansPage; plans: Plan[] }) {
  const { colors } = useAppTheme();
  if (!page.compare.rows.length || plans.length === 0) return null;
  const yes = (b: boolean) =>
    b ? <Check size={16} color={colors.success} strokeWidth={2.6} /> : <X size={16} color={colors.textSecondary} />;
  return (
    <View style={[styles.compare, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.compareTitle, { color: colors.text }]} accessibilityRole="header">
        {page.compare.title}
      </Text>
      <View style={[styles.cRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.cLabel, { color: colors.textSecondary }]}>{page.compare.feature_label}</Text>
        {plans.map(p => (
          <Text key={p.id} style={[styles.cHead, { color: colors.text }]}>
            {p.name}
          </Text>
        ))}
      </View>
      {page.compare.rows.map(row => (
        <View key={row.label} style={[styles.cRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.cLabel, { color: colors.text }]}>{row.label}</Text>
          {plans.map(p => {
            const cell = row.cells[p.id];
            return (
              <View key={p.id} style={styles.cCell}>
                {typeof cell === 'boolean' ? (
                  yes(cell)
                ) : (
                  <Text style={[styles.cValue, { color: colors.text }]}>{cell ?? '—'}</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  content: { padding: spacing.md, gap: 14, paddingBottom: spacing.xl },
  head: { gap: 4, paddingVertical: 4, alignItems: 'center' },
  centerBone: { alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center' },
  reason: { flexDirection: 'row', gap: 12, borderRadius: radius.lg, padding: 14, alignItems: 'flex-start' },
  reasonIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  reasonTitle: { fontSize: 16, fontWeight: '800' },
  reasonText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  currentLine: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 10 },
  currentText: { fontSize: 13.5, flex: 1 },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: 8, overflow: 'hidden' },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ribbonText: { fontSize: 11.5, fontWeight: '800' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 19, fontWeight: '800', flex: 1 },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, marginRight: 70 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  desc: { fontSize: 13.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
  price: { fontSize: 28, fontWeight: '800' },
  per: { fontSize: 13 },
  mrp: { fontSize: 13, textDecorationLine: 'line-through', marginLeft: 6 },
  save: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 },
  saveText: { fontSize: 11.5, fontWeight: '800' },
  yearly: { fontSize: 12.5, marginTop: -4 },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },
  off: { textDecorationLine: 'line-through' },
  note: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  button: { alignSelf: 'stretch', marginTop: 6 },
  payBtn: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  payBtnText: { fontSize: 15.5, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  compare: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  compareTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cLabel: { flex: 1.8, fontSize: 13 },
  cHead: { flex: 1, fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  cCell: { flex: 1, alignItems: 'center' },
  cValue: { fontSize: 12.5, fontWeight: '700' },
  trust: { gap: 6, alignItems: 'center' },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12.5 },
  dev: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: 12, gap: 10 },
  devHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  devTitle: { fontSize: 12.5, fontWeight: '700' },
  devRow: { flexDirection: 'row', gap: 8 },
  devBtn: { flex: 1, minHeight: 42 },
});
