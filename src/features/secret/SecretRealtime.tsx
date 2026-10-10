import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { onSocketEvent, onSocketReconnect } from '@/features/chats/chatController';
import { openCelebration } from '@/features/crush/celebration';
import { crushKeys } from '@/features/crush/crushQueries';
import { queryClient } from '@/features/entities/entityCache';
import { refreshNotifications } from '@/features/notifications/useNotifications';
import { navigationRef } from '@/navigation/navigationRef';
import { paymentsApi } from '@/services/api/payments';
import { secretCrushApi } from '@/services/api/secretCrush';
import type { Subscription } from '@/services/api/subscriptions';

import { applySubscription, refreshSecret } from './secretQueries';

const SECRET_EVENTS = [
  'secret.new',
  'secret.message',
  'secret.revealed',
  'secret.summary',
  'crush.added',
  'crush.summary',
];

/** A match this user hasn't celebrated yet opens on launch and when the app comes back. */
async function openPendingCelebration() {
  try {
    const summary = await queryClient.fetchQuery({
      queryKey: crushKeys.summary,
      queryFn: secretCrushApi.summary,
      staleTime: 0,
    });
    if (summary.pending_celebration_match_id) {
      openCelebration(summary.pending_celebration_match_id);
    }
  } catch {
    // Offline: try again on the next foreground.
  }
}

const PAYMENT_SCREENS = new Set([
  'Checkout',
  'PayByQr',
  'PaymentProcessing',
  'PurchaseSuccess',
  'PaymentFailed',
  'PaymentPending',
]);

/** The app was killed mid-payment: show its confirmation instead of letting the user pay twice. */
async function resumePendingPayment() {
  try {
    const pending = await paymentsApi.pending();
    if (!pending || !navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (current && PAYMENT_SCREENS.has(current)) return;
    navigationRef.navigate('PaymentProcessing', { checkoutId: pending.id });
  } catch {
    // Offline: the webhook still finishes the payment.
  }
}

/** Keeps Secret Messages, Secret Crush, plan and notification badges in sync with the server. */
export function SecretRealtime() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';

  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      refreshSecret().catch(() => {});
      refreshNotifications().catch(() => {});
    };
    const offs = [
      ...SECRET_EVENTS.map(e => onSocketEvent(e, refresh)),
      onSocketEvent('crush.matched', p => {
        refresh();
        const matchId = (p as { match_id?: string } | undefined)?.match_id;
        if (matchId) openCelebration(matchId);
      }),
      onSocketEvent('subscription.updated', p => applySubscription(p as Subscription)),
      onSocketReconnect(() => refreshSecret().catch(() => {})),
    ];
    // The navigator mounts its signed-in screens right after sign-in; give it a moment.
    const timer = setTimeout(() => {
      openPendingCelebration();
      resumePendingPayment();
    }, 1500);
    const appState = AppState.addEventListener('change', s => {
      if (s === 'active') openPendingCelebration();
    });
    return () => {
      offs.forEach(off => off());
      clearTimeout(timer);
      appState.remove();
    };
  }, [signedIn]);

  return null;
}
