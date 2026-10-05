import { Ban } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { UserRow } from '@/components/follows/UserRow';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/services/api/client';
import { safetyApi, type BlockedUser } from '@/services/api/safety';
import { useStatusBar } from '@/navigation/useStatusBar';
import { spacing, useAppTheme } from '@/theme';

export function BlockedAccountsScreen() {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<BlockedUser[] | null>(null);
  useStatusBar();

  const load = useCallback(() => {
    safetyApi
      .blocked()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = (user: BlockedUser) => {
    Alert.alert(`Unblock @${user.username}?`, 'They will not be followed automatically.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await safetyApi.unblock(user.id);
            setItems(current => (current ?? []).filter(row => row.id !== user.id));
          } catch (err) {
            Alert.alert(
              "Couldn't unblock",
              err instanceof ApiError ? err.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Blocked accounts" back />
      <FlatList
        data={items ?? []}
        keyExtractor={user => user.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon={<Ban size={34} color={colors.primary} />}
              title="No blocked accounts"
              text="People you block can't find your profile, posts or stories."
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <UserRow
            user={{
              username: item.username,
              display_name: item.display_name,
              avatar_url: item.avatar_url,
              is_private: false,
            }}
            onPress={() => {}}
            trailing={
              <Button
                title="Unblock"
                variant="secondary"
                onPress={() => unblock(item)}
                style={styles.unblock}
              />
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: spacing.lg },
  unblock: { minHeight: 34, paddingHorizontal: 12 },
});
