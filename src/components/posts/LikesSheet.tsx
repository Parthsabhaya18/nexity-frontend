import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FollowButton } from '@/components/follows/FollowButton';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { RootStackParamList } from '@/navigation/types';
import type { Page, UserSummary } from '@/services/api/follows';
import { spacing, useAppTheme } from '@/theme';

export function LikesSheet({
  open,
  load,
  onClose,
}: {
  open: boolean;
  load: (cursor: string | null, signal: AbortSignal) => Promise<Page<UserSummary>>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<UserSummary[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setItems(null);
    load(null, controller.signal)
      .then(page => {
        if (!controller.signal.aborted) setItems(page.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [open, load]);

  return (
    <BottomSheet visible={open} onClose={onClose} style={styles.sheet}>
      <Text style={[styles.title, { color: colors.text }]}>Likes</Text>
      <FlatList
        data={items ?? []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          items ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No likes yet
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.person}
              onPress={() => {
                onClose();
                navigation.navigate('UserProfile', { username: item.username });
              }}
            >
              <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
              <View style={styles.meta}>
                <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                  {item.username}
                </Text>
                <Text
                  style={[styles.name, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.display_name}
                </Text>
              </View>
            </Pressable>
            {item.is_self ? null : (
              <FollowButton user={item} status={item.follow_status} variant="compact" />
            )}
          </View>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { height: '72%' },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  list: { paddingBottom: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flex: 1, minWidth: 0 },
  username: { fontWeight: '700', fontSize: 14 },
  name: { fontSize: 13, marginTop: 1 },
});
