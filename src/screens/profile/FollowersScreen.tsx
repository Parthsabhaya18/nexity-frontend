import { Lock, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { FollowButton } from '@/components/follows/FollowButton';
import { UserRow } from '@/components/follows/UserRow';
import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { TabBar, TabButton } from '@/components/profile/ProfileParts';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { useAuth } from '@/features/auth/AuthProvider';
import { primeFollowStatuses } from '@/features/follows/followStore';
import { usePagedList } from '@/features/follows/usePagedList';
import { ApiError } from '@/services/api/client';
import { followsApi, type UserSummary } from '@/services/api/follows';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

type Kind = 'followers' | 'following';

export function FollowersScreen({
  navigation,
  route,
}: ScreenProps<'Followers'>) {
  const { userId, username } = route.params;
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<Kind>(route.params.tab);
  useStatusBar();

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar back title={username} />
      <TabBar>
        <TabButton
          label="Followers"
          active={kind === 'followers'}
          onPress={() => setKind('followers')}
        />
        <TabButton
          label="Following"
          active={kind === 'following'}
          onPress={() => setKind('following')}
        />
      </TabBar>
      <ConnectionsList
        key={kind}
        userId={userId}
        kind={kind}
        onOpen={u =>
          u.is_self
            ? navigation.navigate('Profile')
            : navigation.push('UserProfile', { username: u.username })
        }
      />
    </SafeAreaView>
  );
}

function ConnectionsList({
  userId,
  kind,
  onOpen,
}: {
  userId: string;
  kind: Kind;
  onOpen: (user: UserSummary) => void;
}) {
  const { colors } = useAppTheme();
  const { user: me, refreshUser } = useAuth();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 300);
  const isOwnFollowers = kind === 'followers' && me?.id === userId;

  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      followsApi.connections(userId, kind, { cursor, q, signal }),
    [userId, kind, q],
  );
  const list = usePagedList(fetchPage, { onPage: primeFollowStatuses });
  const { setItems } = list;

  const confirmRemove = useCallback(
    (u: UserSummary) =>
      Alert.alert(
        'Remove follower?',
        `We won't tell @${u.username} they were removed from your followers.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await followsApi.removeFollower(u.id);
                setItems(prev => prev.filter(i => i.id !== u.id));
                refreshUser().catch(() => {});
              } catch (err) {
                Alert.alert(
                  "Couldn't remove follower",
                  err instanceof ApiError ? err.message : 'Please try again.',
                );
              }
            },
          },
        ],
      ),
    [setItems, refreshUser],
  );

  const privateError = list.error?.code === 'PRIVATE_ACCOUNT';

  return (
    <FlatList
      data={list.items}
      keyExtractor={u => u.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListHeaderComponent={
        privateError ? undefined : (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${kind}`}
          />
        )
      }
      renderItem={({ item }) => (
        <UserRow
          user={item}
          onPress={() => onOpen(item)}
          trailing={
            item.is_self ? null : isOwnFollowers ? (
              <Button
                title="Remove"
                variant="secondary"
                onPress={() => confirmRemove(item)}
                style={styles.remove}
              />
            ) : (
              <FollowButton user={item} status={item.follow_status} />
            )
          }
        />
      )}
      ListEmptyComponent={
        list.loading ? (
          <UserListSkeleton button />
        ) : privateError ? (
          <EmptyState
            icon={<Lock size={34} color={colors.primary} />}
            title="This account is private"
            text="Follow this account to see who they follow and who follows them."
          />
        ) : list.error ? (
          <EmptyState
            icon={<Users size={34} color={colors.primary} />}
            title="Couldn't load this list"
            text={list.error.message}
            action={
              <Button
                title="Try again"
                variant="secondary"
                onPress={list.retry}
                style={styles.retry}
              />
            }
          />
        ) : (
          <EmptyState
            icon={<Users size={34} color={colors.primary} />}
            title={
              q
                ? `No results for "${q}"`
                : kind === 'followers'
                ? 'No followers yet'
                : 'Not following anyone yet'
            }
            text={q ? undefined : 'Find people you know with Search.'}
          />
        )
      }
      ListFooterComponent={
        list.loadingMore ? (
          <UserListSkeleton rows={2} button />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.lg },
  retry: { minWidth: 180 },
  remove: { minHeight: 34, borderRadius: radius.sm, paddingHorizontal: 14 },
});
