import { useQuery } from '@tanstack/react-query';
import { Ban, CloudOff } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { GhostAvatar } from '@/components/secret/SecretUI';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { dayLabel } from '@/features/secret/format';
import { refreshSecret, secretKeys } from '@/features/secret/secretQueries';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { secretMessagesApi } from '@/services/api/secretMessages';
import { spacing, useAppTheme } from '@/theme';

/** Anonymous blocks: the list never says who was blocked. */
export function SecretBlocksScreen() {
  const { colors } = useAppTheme();
  useStatusBar();
  const blocksQ = useQuery({ queryKey: secretKeys.blocks, queryFn: secretMessagesApi.blocks });
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unblock = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await secretMessagesApi.unblock(target);
      setTarget(null);
      showToast('Unblocked', 'success');
      await Promise.all([blocksQ.refetch(), refreshSecret()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't unblock.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Blocked secret senders" back />
      <FlatList
        data={blocksQ.data ?? []}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            People you blocked from a Secret Message. They stay anonymous, even here.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <GhostAvatar size={44} />
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>Secret sender</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                Blocked · {dayLabel(item.day)}
              </Text>
            </View>
            <Button title="Unblock" variant="secondary" onPress={() => setTarget(item.id)} />
          </View>
        )}
        ListEmptyComponent={
          blocksQ.isPending ? (
            <SkeletonLoader variant="rect" height={60} />
          ) : blocksQ.isError ? (
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title="Couldn't load"
              actionLabel="Try again"
              onAction={() => blocksQ.refetch()}
            />
          ) : (
            <EmptyState
              icon={<Ban size={34} color={colors.primary} />}
              title="No blocked secret senders"
            />
          )
        }
      />
      <ConfirmDialog
        visible={!!target}
        title="Unblock this sender?"
        message="They'll be able to send you Secret Messages again."
        confirmLabel="Unblock"
        loading={busy}
        onConfirm={unblock}
        onCancel={() => setTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: 10, flexGrow: 1 },
  note: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12.5, marginTop: 2 },
});
