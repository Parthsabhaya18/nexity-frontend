import { Ban, Flag } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import { ActionSheet } from '@/components/ui/ActionSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { refreshSecret } from '@/features/secret/secretQueries';
import { ApiError } from '@/services/api/client';
import {
  SECRET_REPORT_REASONS,
  secretMessagesApi,
} from '@/services/api/secretMessages';
import { useAppTheme } from '@/theme';

type Step = 'menu' | 'report' | 'block' | null;

const failed = (err: unknown) =>
  showToast(
    err instanceof ApiError && !err.isNetworkError
      ? err.message
      : 'No connection. Try again.',
    'error',
  );

/**
 * Report / Block for an anonymous sender. Works on every plan, and the sender's
 * identity stays hidden from the receiver throughout.
 */
export function useSecretSafety(opts?: { onBlocked?: () => void }) {
  const { colors } = useAppTheme();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const onBlocked = opts?.onBlocked;

  const open = useCallback((id: string) => {
    setThreadId(id);
    setStep('menu');
  }, []);
  const close = () => setStep(null);

  const report = async (reason: (typeof SECRET_REPORT_REASONS)[number]['id']) => {
    if (!threadId) return;
    close();
    try {
      await secretMessagesApi.report(threadId, reason);
      showToast('Thanks. Your report stays private.', 'success');
    } catch (err) {
      failed(err);
    }
  };

  const block = async () => {
    if (!threadId || busy) return;
    setBusy(true);
    try {
      await secretMessagesApi.blockSender(threadId);
      close();
      showToast("Blocked. They can't send you Secret Messages anymore.", 'success');
      await refreshSecret();
      onBlocked?.();
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  };

  const element = (
    <>
      <ActionSheet
        visible={step === 'menu'}
        message="Your report stays private. The sender's identity stays hidden."
        onClose={close}
        options={[
          {
            label: 'Report this message',
            icon: <Flag size={20} color={colors.danger} />,
            destructive: true,
            onPress: () => setStep('report'),
          },
          {
            label: 'Block sender',
            icon: <Ban size={20} color={colors.danger} />,
            destructive: true,
            onPress: () => setStep('block'),
          },
        ]}
      />
      <ActionSheet
        visible={step === 'report'}
        title="Why are you reporting this?"
        onClose={close}
        options={SECRET_REPORT_REASONS.map(r => ({
          label: r.label,
          onPress: () => report(r.id),
        }))}
      />
      <ConfirmDialog
        visible={step === 'block'}
        title="Block this sender?"
        message="They won't be able to send you Secret Messages, and you still won't see who they are."
        confirmLabel="Block"
        destructive
        loading={busy}
        onConfirm={block}
        onCancel={close}
      />
    </>
  );

  return { open, element };
}
