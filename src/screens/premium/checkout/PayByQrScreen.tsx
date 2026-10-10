import { QrCode, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { showToast } from '@/components/ui/Toast';
import { saveToGallery } from '@/features/media/saveToGallery';
import { inr, PERIOD_LABEL, PLAN_NAME } from '@/features/payments/format';
import { applySubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { type CheckoutState, paymentsApi } from '@/services/api/payments';
import { subscriptionsApi } from '@/services/api/subscriptions';
import { radius, spacing, useAppTheme } from '@/theme';

const POLL_MS = 3000;

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PayByQrScreen({ navigation, route }: ScreenProps<'PayByQr'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const { checkoutId } = route.params;
  const [qr, setQr] = useState<(CheckoutState & { simulator: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<'save' | 'sim' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQr(await paymentsApi.qr(checkoutId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the QR code.");
    }
  }, [checkoutId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeBy = qr?.qr ? new Date(qr.qr.close_by).getTime() : null;
  const expired = closeBy != null && now >= closeBy;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!qr || expired) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const s = await paymentsApi.status(checkoutId);
        if (!alive) return;
        if (s.status === 'paid') {
          alive = false;
          clearInterval(t);
          applySubscription(await subscriptionsApi.me());
          navigation.replace('PurchaseSuccess', { checkoutId });
        } else if (s.status === 'amount_mismatch') {
          alive = false;
          clearInterval(t);
          navigation.replace('PaymentFailed', { checkoutId });
        }
      } catch {
        // Keep polling.
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [qr, expired, checkoutId, navigation]);

  const amount = qr ? inr(qr.amount_paise) : '';
  const imageUrl = qr?.qr?.image_url ?? null;

  const save = async () => {
    if (!imageUrl) return;
    setBusy('save');
    try {
      await saveToGallery(imageUrl, 'image');
      showToast('QR saved to your gallery', 'success');
    } catch {
      showToast("Couldn't save the QR. Allow Photos access and try again.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const share = () => {
    if (!imageUrl || !qr) return;
    Share.share({
      message: `Scan to pay ${amount} for Nexity ${PLAN_NAME[qr.plan_id]}: ${imageUrl}`,
    }).catch(() => {});
  };

  const simulateScan = async () => {
    setBusy('sim');
    try {
      await paymentsApi.simulate(checkoutId, 'success', 'upi');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Test payment failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Pay by QR" back />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <>
            <Banner tone="error" message={error} />
            <Button title="Try again" onPress={load} />
          </>
        ) : !qr ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <Text style={[styles.amount, { color: colors.text }]}>{amount}</Text>
            <Text style={[styles.planLine, { color: colors.textSecondary }]}>
              Nexity {PLAN_NAME[qr.plan_id]} · {PERIOD_LABEL[qr.period]} · one-time
            </Text>
            <View
              style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLabel={`UPI QR code for ${amount}`}
            >
              {expired ? (
                <View style={styles.qrInner}>
                  <QrCode size={64} color={colors.textSecondary} />
                  <Text style={[styles.expired, { color: colors.text }]}>QR expired</Text>
                </View>
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <View style={styles.qrInner}>
                  <QrCode size={120} color={colors.text} />
                  <Text style={[styles.testNote, { color: colors.textSecondary }]}>
                    Test build: there is no real QR without Razorpay keys.
                  </Text>
                </View>
              )}
            </View>
            {expired ? (
              <Button
                title="Get a new QR"
                onPress={() =>
                  navigation.replace('Checkout', { planId: qr.plan_id as 'plus' | 'premium', period: qr.period })
                }
              />
            ) : (
              <>
                <Text style={[styles.countdown, { color: colors.text }]} accessibilityLiveRegion="polite">
                  Expires in {closeBy ? mmss(closeBy - now) : '—'}
                </Text>
                <Text style={[styles.help, { color: colors.textSecondary }]}>
                  Scan with any UPI app — Google Pay, PhonePe, Paytm, BHIM. This page updates by itself
                  once the payment arrives.
                </Text>
                {imageUrl ? (
                  <View style={styles.row}>
                    <Button
                      title="Save QR"
                      variant="secondary"
                      loading={busy === 'save'}
                      onPress={save}
                      style={styles.flex}
                    />
                    <Button title="Share" variant="secondary" onPress={share} style={styles.flex} />
                  </View>
                ) : null}
                {qr.simulator ? (
                  <Button
                    title="Simulate: pay from another phone"
                    loading={busy === 'sim'}
                    disabled={!!busy}
                    onPress={simulateScan}
                  />
                ) : null}
                <View style={styles.iconsRow}>
                  <ShieldCheck size={14} color={colors.textSecondary} />
                  <Text style={[styles.small, { color: colors.textSecondary }]}>
                    Paying a different amount isn't possible — the QR is fixed to {amount}.
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: 14, alignItems: 'stretch' },
  loading: { paddingVertical: 80, alignItems: 'center' },
  amount: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  planLine: { fontSize: 14, textAlign: 'center', marginTop: -8 },
  qrBox: {
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: { width: 250, height: 250 },
  qrInner: { alignItems: 'center', gap: 10, padding: 16 },
  testNote: { fontSize: 12, textAlign: 'center' },
  expired: { fontSize: 16, fontWeight: '800' },
  countdown: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  help: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  iconsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  small: { fontSize: 12, flexShrink: 1 },
});
