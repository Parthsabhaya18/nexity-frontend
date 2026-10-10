import { Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useReduceMotion } from '@/components/ui/SkeletonLoader';
import { takeResult } from '@/features/payments/razorpay';
import { applySubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { type CheckoutStatus, paymentsApi } from '@/services/api/payments';
import { subscriptionsApi } from '@/services/api/subscriptions';
import { useAppTheme } from '@/theme';

const POLL_MS = 2000;
const GIVE_UP_MS = 60_000;
const FAILED: ReadonlySet<CheckoutStatus> = new Set(['failed', 'amount_mismatch']);

const sleep = (ms: number) => new Promise<void>(r => setTimeout(() => r(), ms));

export function PaymentProcessingScreen({ navigation, route }: ScreenProps<'PaymentProcessing'>) {
  const { checkoutId } = route.params;
  const { colors } = useAppTheme();
  useStatusBar();
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState('Confirming your payment…');

  // Leaving now could make people pay twice.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);

  useEffect(() => {
    let alive = true;
    const done = async (status: 'paid' | 'failed' | 'pending') => {
      if (!alive) return;
      alive = false;
      if (status === 'paid') {
        try {
          applySubscription(await subscriptionsApi.me());
        } catch {
          // The socket update or the next screen refreshes it.
        }
        navigation.replace('PurchaseSuccess', { checkoutId });
      } else if (status === 'failed') {
        navigation.replace('PaymentFailed', { checkoutId });
      } else {
        navigation.replace('PaymentPending', { checkoutId });
      }
    };

    (async () => {
      const result = takeResult(checkoutId);
      if (result) {
        try {
          const v = await paymentsApi.verify(checkoutId, result);
          applySubscription(v.subscription);
          if (v.status === 'paid') return done('paid');
          if (FAILED.has(v.status)) return done('failed');
        } catch (err) {
          if (err instanceof ApiError && err.status && err.status < 500 && !err.isNetworkError) {
            return done('failed');
          }
          // Offline / server hiccup: the webhook still finishes it; keep polling.
        }
      }
      if (!alive) return;
      setStep('Waiting for your bank to confirm…');
      const started = Date.now();
      while (alive && Date.now() - started < GIVE_UP_MS) {
        await sleep(POLL_MS);
        if (!alive) return;
        try {
          const s = await paymentsApi.status(checkoutId);
          if (s.status === 'paid') return done('paid');
          if (FAILED.has(s.status)) return done('failed');
        } catch {
          // Keep trying until the timeout.
        }
      }
      done('pending');
    })();

    return () => {
      alive = false;
    };
  }, [checkoutId, navigation]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.center} accessibilityLiveRegion="polite">
        <View style={styles.ringWrap}>
          <Animated.View
            style={[
              styles.ring,
              { borderColor: colors.primarySoft, borderTopColor: colors.primary, transform: [{ rotate }] },
            ]}
          />
          <Lock size={30} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {step}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Please don't close the app.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  ringWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 5 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center' },
});
