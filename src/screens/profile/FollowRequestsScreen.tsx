import { useNavigation } from '@react-navigation/native';
import { UserPlus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { FollowButton } from '@/components/follows/FollowButton';
import { UserRow } from '@/components/follows/UserRow';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { primeFollowStatuses } from '@/features/follows/followStore';
import { usePagedList } from '@/features/follows/usePagedList';
import { ApiError } from '@/services/api/client';
import {
  type FollowRequest,
  followsApi,
  type UserSummary,
} from '@/services/api/follows';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

/** A request row, or the requester after Confirm so they can be followed back. */
type Row = FollowRequest & { accepted?: UserSummary };

export function FollowRequestsScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { refreshUser } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  useStatusBar();

  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      followsApi.requests({ cursor, signal }),
    [],
  );
  const list = usePagedList<Row>(fetchPage, {
    onPage: rows => primeFollowStatuses(rows.map(r => r.user)),
  });
  const { setItems } = list;

  const respond = useCallback(
    async (row: Row, action: 'accept' | 'decline') => {
      setBusyId(row.id);
      try {
        if (action === 'accept') {
          const { user } = await followsApi.acceptRequest(row.id);
          if (user) primeFollowStatuses([user]);
          setItems(prev =>
            prev.map(r =>
              r.id === row.id ? { ...r, accepted: user ?? r.user } : r,
            ),
          );
        } else {
          await followsApi.declineRequest(row.id);
          setItems(prev => prev.filter(r => r.id !== row.id));
        }
        refreshUser().catch(() => {});
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setItems(prev => prev.filter(r => r.id !== row.id));
        } else {
          Alert.alert(
            "Couldn't update request",
            err instanceof ApiError ? err.message : 'Please try again.',
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [setItems, refreshUser],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Follow requests" back />
      <FlatList
        data={list.items}
        keyExtractor={r => r.id}
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
        renderItem={({ item }) => {
          const user = item.accepted ?? item.user;
          const busy = busyId === item.id;
          return (
            <UserRow
              user={user}
              onPress={() =>
                navigation.navigate('UserProfile', { username: user.username })
              }
              trailing={
                item.accepted ? (
                  <FollowButton
                    user={user}
                    status={user.follow_status}
                    followsYou
                  />
                ) : (
                  <>
                    <Button
                      title="Confirm"
                      onPress={() => respond(item, 'accept')}
                      disabled={busyId !== null}
                      loading={busy}
                      style={styles.action}
                    />
                    <Button
                      title="Delete"
                      variant="secondary"
                      onPress={() => respond(item, 'decline')}
                      disabled={busyId !== null}
                      style={styles.action}
                    />
                  </>
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          list.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : list.error ? (
            <EmptyState
              icon={<UserPlus size={34} color={colors.primary} />}
              title="Couldn't load requests"
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
              icon={<UserPlus size={34} color={colors.primary} />}
              title="No pending requests"
              text="When people ask to follow you, you'll see their requests here."
            />
          )
        }
        ListFooterComponent={
          list.loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.footer} />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: spacing.sm },
  loader: { marginTop: spacing.xl },
  footer: { marginVertical: spacing.md },
  retry: { minWidth: 180 },
  action: { minHeight: 34, borderRadius: radius.sm, paddingHorizontal: 14 },
});
