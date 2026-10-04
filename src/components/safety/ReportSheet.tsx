import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ApiError } from '@/services/api/client';
import { safetyApi, type ReportReason, type ReportTarget } from '@/services/api/safety';
import { radius, spacing, useAppTheme } from '@/theme';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'violence', label: 'Violence' },
  { id: 'self_harm', label: 'Self-harm' },
  { id: 'other', label: 'Other' },
];

type Props = {
  visible: boolean;
  targetType: ReportTarget;
  targetId: string;
  /** When set, the thank-you step can block this account. */
  blockUserId?: string;
  username?: string;
  onClose: () => void;
  onBlocked?: () => void;
};

/** Why-are-you-reporting sheet. A repeat report still ends on the thank-you step. */
export function ReportSheet({
  visible,
  targetType,
  targetId,
  blockUserId,
  username,
  onClose,
  onBlocked,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setDetails('');
    setDone(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await safetyApi.report({
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!blockUserId) return;
    setBusy(true);
    try {
      await safetyApi.block(blockUserId);
      onBlocked?.();
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Please try again.');
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {done ? (
            <View style={styles.done}>
              <Text style={[styles.title, { color: colors.text }]}>Thanks for letting us know</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Your report is in. We review reports within 24 hours.
              </Text>
              {blockUserId && username ? (
                <Button title={`Block @${username}`} onPress={block} loading={busy} />
              ) : null}
              <Button title="Done" variant="secondary" onPress={close} />
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                Why are you reporting this?
              </Text>
              <ScrollView style={styles.list}>
                {REASONS.map(item => {
                  const active = reason === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setReason(item.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[styles.row, { borderColor: colors.border }]}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        {active ? (
                          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>
                      <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {reason === 'other' ? (
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Tell us what happened"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
              ) : null}
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <Button
                title="Submit"
                onPress={submit}
                loading={busy}
                disabled={!reason || (reason === 'other' && details.trim().length < 10)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  list: { maxHeight: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  error: { marginBottom: 8 },
  done: { gap: 12, paddingBottom: 8 },
});
