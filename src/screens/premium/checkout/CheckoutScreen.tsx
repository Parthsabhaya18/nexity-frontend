import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Crown,
  Gift,
  Landmark,
  Lock,
  QrCode,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { GradientFill } from '@/components/ui/GradientFill';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { day, inr, PERIOD_LABEL, PERIOD_UNIT, PLAN_NAME } from '@/features/payments/format';
import type { UpiApp } from '@/features/payments/razorpay';
import { installedUpiApps } from '@/features/payments/upiApps';
import { usePayRunner } from '@/features/payments/usePayRunner';
import { usePlans } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { type PayMethod, paymentsApi } from '@/services/api/payments';
import type { Period } from '@/services/api/subscriptions';
import { radius, spacing, useAppTheme } from '@/theme';
import { uuidv4 } from '@/utils/uuid';

const PERIODS: Period[] = ['monthly', 'quarterly', 'yearly'];

const METHODS: {
  id: PayMethod;
  label: string;
  sub: string;
  icon: typeof Smartphone;
  oneTimeOnly?: boolean;
}[] = [
  { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm, BHIM & more', icon: Smartphone },
  {
    id: 'qr',
    label: 'Scan QR',
    sub: 'Pay from another phone or any UPI scanner',
    icon: QrCode,
    oneTimeOnly: true,
  },
  { id: 'card', label: 'Debit / credit card', sub: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', sub: 'All major Indian banks', icon: Landmark },
  {
    id: 'wallet',
    label: 'Wallet',
    sub: 'Paytm, Amazon Pay, MobiKwik',
    icon: Wallet,
    oneTimeOnly: true,
  },
];

const UPI_APPS: { id: UpiApp; label: string }[] = [
  { id: 'google_pay', label: 'Google Pay' },
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'paytm', label: 'Paytm' },
  { id: 'bhim', label: 'BHIM' },
  { id: 'upi_id', label: 'UPI ID' },
];

export function CheckoutScreen({ navigation, route }: ScreenProps<'Checkout'>) {
  const { colors, gradient } = useAppTheme();
  useStatusBar();
  const { planId } = route.params;
  const [period, setPeriod] = useState<Period>(route.params.period ?? 'monthly');
  const [autopay, setAutopay] = useState(true);
  const [couponText, setCouponText] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [method, setMethod] = useState<PayMethod>('upi');
  const [upiApp, setUpiApp] = useState<UpiApp>('google_pay');
  const [upiChoices, setUpiChoices] = useState<UpiApp[] | null>(null);
  const [paying, setPaying] = useState(false);
  const attemptKey = useRef<string | null>(null);
  const runner = usePayRunner();
  const plans = usePlans().data;
  const plan = plans?.data.find(p => p.id === planId);

  // Any change makes a new attempt (a retry of the same inputs reuses the key).
  useEffect(() => {
    attemptKey.current = null;
  }, [period, autopay, coupon, method, upiApp]);

  useEffect(() => {
    if (autopay && (method === 'qr' || method === 'wallet')) setMethod('upi');
  }, [autopay, method]);

  useEffect(() => {
    let live = true;
    installedUpiApps()
      .then(apps => {
        if (!live || !apps) return;
        setUpiChoices(apps);
        setUpiApp(current => (apps.includes(current) ? current : (apps[0] ?? 'upi_id')));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const quoteQ = useQuery({
    queryKey: ['payments', 'quote', planId, period, autopay, coupon],
    queryFn: () =>
      paymentsApi.quote({ plan_id: planId, period, autopay, coupon_code: coupon }),
    retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 2,
  });
  const q = quoteQ.data;
  const blocked = quoteQ.error instanceof ApiError && quoteQ.error.status === 409 ? quoteQ.error : null;

  const applyCoupon = async () => {
    const code = couponText.trim().toUpperCase();
    if (!code) {
      setCouponError('Enter a coupon code.');
      return;
    }
    Keyboard.dismiss();
    setApplying(true);
    setCouponError(null);
    try {
      const res = await paymentsApi.quote({ plan_id: planId, period, autopay, coupon_code: code });
      setCoupon(code);
      showToast(`Coupon applied — ${res.coupon?.pct ?? ''}% off 🎉`, 'success');
    } catch (err) {
      setCouponError(err instanceof ApiError ? err.message : "Couldn't check that code. Try again.");
    } finally {
      setApplying(false);
    }
  };

  const pay = async () => {
    if (!q || paying) return;
    setPaying(true);
    attemptKey.current ??= uuidv4();
    try {
      const c = await paymentsApi.checkout(
        { plan_id: planId, period, autopay, coupon_code: coupon, method },
        attemptKey.current,
      );
      if (method === 'qr') {
        navigation.replace('PayByQr', { checkoutId: c.checkout_id });
        return;
      }
      const outcome = await runner.run(c, method, method === 'upi' ? upiApp : null);
      if (outcome === 'cancelled') attemptKey.current = null;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHECKOUT_IN_PROGRESS') {
        const id = (err.details as { checkout_id?: string } | undefined)?.checkout_id;
        if (id) {
          navigation.replace('PaymentProcessing', { checkoutId: id });
          return;
        }
      }
      if (err instanceof ApiError && err.code?.startsWith('COUPON_')) {
        setCoupon(null);
        setCouponError(err.message);
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
                  ? `${PERIOD_LABEL[period]} plan · renews automatically · cancel anytime`
                  : 'One-time · no auto-renew'}
              </Text>
            </View>
          </View>

          <View style={styles.periods} accessibilityRole="radiogroup" accessibilityLabel="Billing period">
            {PERIODS.map(p => {
              const price = plan?.pricing[p];
              const active = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.period,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primarySofter : colors.surface,
                    },
                  ]}
                >
                  {price?.save_pct ? (
                    <View style={[styles.periodSave, { backgroundColor: colors.success }]}>
                      <Text style={[styles.periodSaveText, { color: colors.onButton }]}>
                        Save {price.save_pct}%
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.periodName, { color: colors.text }]}>{PERIOD_LABEL[p]}</Text>
                  <Text style={[styles.periodPrice, { color: colors.text }]}>
                    {price ? inr(price.amount_paise) : '—'}
                  </Text>
                  <Text style={[styles.periodPer, { color: colors.textSecondary }]}>
                    {price && price.months > 1 ? `${inr(price.per_month_paise)}/mo` : 'per month'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.autopay, { borderColor: colors.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.autopayTitle, { color: colors.text }]}>Auto-renew with AutoPay</Text>
              <Text style={[styles.autopayText, { color: colors.textSecondary }]}>
                {autopay
                  ? 'No need to pay again every month. Cancel anytime in Subscription.'
                  : `Pay once for ${period === 'monthly' ? '1 month' : period === 'quarterly' ? '3 months' : '1 year'}. We'll remind you before it ends.`}
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
              {q.coupon ? (
                <Row label={`Coupon ${q.coupon.code}`} value={`−${inr(q.coupon.off_paise)}`} discount />
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

          {coupon ? (
            <View style={[styles.couponOn, { backgroundColor: colors.successSoft }]}>
              <Gift size={16} color={colors.success} />
              <Text style={[styles.couponOnText, { color: colors.text }]}>
                <Text style={styles.bold}>{coupon}</Text> applied
              </Text>
              <LinkButton
                title="Remove"
                onPress={() => {
                  setCoupon(null);
                  setCouponText('');
                }}
              />
            </View>
          ) : (
            <View>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponText}
                  onChangeText={t => {
                    setCouponText(t);
                    setCouponError(null);
                  }}
                  placeholder="Have a coupon code?"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={applyCoupon}
                  accessibilityLabel="Coupon code"
                  style={[
                    styles.couponInput,
                    { color: colors.text, borderColor: couponError ? colors.danger : colors.border, backgroundColor: colors.background },
                  ]}
                />
                <Button
                  title="Apply"
                  variant="secondary"
                  loading={applying}
                  disabled={applying}
                  onPress={applyCoupon}
                  style={styles.applyBtn}
                />
              </View>
              {couponError ? (
                <Text style={[styles.couponError, { color: colors.danger }]} accessibilityRole="alert">
                  {couponError}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <Text style={[styles.section, { color: colors.text }]} accessibilityRole="header">
          Payment method
        </Text>
        <View style={styles.methods} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
          {METHODS.filter(m => !(autopay && m.oneTimeOnly)).map(m => {
            const active = m.id === method;
            return (
              <View
                key={m.id}
                style={[
                  styles.method,
                  { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
                ]}
              >
                <Pressable
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${m.label}. ${m.sub}`}
                  style={styles.methodRow}
                >
                  <View style={[styles.methodIcon, { backgroundColor: colors.primarySoft }]}>
                    <m.icon size={19} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.methodLabel, { color: colors.text }]}>{m.label}</Text>
                    <Text style={[styles.methodSub, { color: colors.textSecondary }]}>{m.sub}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: active ? colors.primary : colors.textSecondary }]}>
                    {active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </Pressable>
                {active && m.id === 'upi' ? (
                  <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="UPI app">
                    {UPI_APPS.filter(a => !upiChoices || upiChoices.includes(a.id)).map(a => {
                      const on = a.id === upiApp;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => setUpiApp(a.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={[
                            styles.chip,
                            {
                              borderColor: on ? colors.primary : colors.border,
                              backgroundColor: on ? colors.primarySoft : colors.background,
                            },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: on ? colors.primary : colors.text }]}>
                            {a.id === 'upi_id' ? 'Pay with UPI ID' : a.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {autopay ? (
          <Text style={[styles.qrNote, { color: colors.textSecondary }]}>
            QR and wallets are for one-time payments. Turn off AutoPay to use them.
          </Text>
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
            {paying ? 'Opening payment…' : q ? `Pay ${inr(q.amount_paise)}` : 'Pay'}
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
  bold: { fontWeight: '800' },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 14 },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderTitle: { fontSize: 17, fontWeight: '800' },
  orderSub: { fontSize: 12.5, marginTop: 2 },
  periods: { flexDirection: 'row', gap: 8 },
  period: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingTop: 18,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 2,
  },
  periodSave: {
    position: 'absolute',
    top: -9,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  periodSaveText: { fontSize: 10.5, fontWeight: '800' },
  periodName: { fontSize: 13, fontWeight: '700' },
  periodPrice: { fontSize: 17, fontWeight: '800' },
  periodPer: { fontSize: 11.5 },
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
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 14.5,
    minHeight: 46,
  },
  applyBtn: { minHeight: 46 },
  couponError: { fontSize: 12.5, marginTop: 6 },
  couponOn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 10 },
  couponOnText: { flex: 1, fontSize: 13.5 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 6 },
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
