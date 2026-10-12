import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { queryClient } from '@/features/entities/entityCache';
import { secretMessagesApi } from '@/services/api/secretMessages';

import { secretKeys, useSubscription } from './secretQueries';

/**
 * Every way into "Send a Secret Message" goes through here: Free opens Plans,
 * an open thread opens that thread, a used-up month shows the limit dialog.
 */
export function useStartSecret() {
  const navigation = useNavigation();
  const sub = useSubscription().data;
  const [limitOpen, setLimitOpen] = useState(false);

  const monthly = sub?.limits.secret_messages_per_month ?? 0;
  const canSend = monthly !== 0;
  const left = sub?.usage.secret_messages_left ?? null;
  const outOfMessages = canSend && left !== null && left <= 0;

  const openPicker = useCallback(() => {
    if (!canSend) return navigation.navigate('Plans', { reason: 'secret-send' });
    if (outOfMessages) return setLimitOpen(true);
    navigation.navigate('SecretPeoplePicker');
  }, [canSend, outOfMessages, navigation]);

  const toUser = useCallback(
    async (user: { id: string; username: string }, opts?: { replace?: boolean }) => {
      if (!canSend) return navigation.navigate('Plans', { reason: 'secret-send' });
      const sent = await queryClient
        .fetchQuery({
          queryKey: secretKeys.sent,
          queryFn: () => secretMessagesApi.sent(),
          staleTime: 10_000,
        })
        .catch(() => null);
      const open = sent?.data.find(
        t => t.status === 'sealed' && t.recipient?.id === user.id,
      );
      const go = opts?.replace
        ? (navigation as unknown as { replace: typeof navigation.navigate }).replace
        : navigation.navigate;
      if (open) {
        showToast('You already have a secret conversation going with them.', 'info');
        return go('SecretThread', { threadId: open.id });
      }
      if (outOfMessages) return setLimitOpen(true);
      go('SecretCompose', { username: user.username });
    },
    [canSend, outOfMessages, navigation],
  );

  const premium = sub?.plan === 'premium';
  const limitDialog = (
    <ConfirmDialog
      visible={limitOpen}
      title={`You've used all ${monthly < 0 ? '' : `${monthly} `}Secret Messages this month`}
      message={
        premium
          ? 'You can send more after your limit resets.'
          : 'Go Premium for unlimited Secret Messages.'
      }
      confirmLabel={premium ? 'OK' : 'Upgrade to Premium'}
      cancelLabel="Not now"
      onCancel={() => setLimitOpen(false)}
      onConfirm={() => {
        setLimitOpen(false);
        if (!premium) navigation.navigate('Plans', { reason: 'limit' });
      }}
    />
  );

  return { canSend, left, openPicker, toUser, limitDialog };
}
