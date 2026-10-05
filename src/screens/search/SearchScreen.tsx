import {
  useFocusEffect,
  useNavigation,
  useScrollToTop,
} from '@react-navigation/native';
import { Clock, SearchX, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type FlatListInstance,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { FollowButton } from '@/components/follows/FollowButton';
import { UserRow } from '@/components/follows/UserRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { primeFollowStatuses } from '@/features/follows/followStore';
import { useTabBarInset } from '@/navigation/BottomNav';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { followsApi, type UserSummary } from '@/services/api/follows';
import { searchHistoryApi } from '@/services/api/search';
import { spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

export function SearchScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const bottomInset = useTabBarInset();
  const listRef = useRef<FlatListInstance>(null);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 300);
  const [history, setHistory] = useState<UserSummary[]>([]);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  useScrollToTop(listRef);
  useStatusBar();

  // Coming back to this tab (e.g. after blocking someone) shows fresh data.
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) setAttempt(a => a + 1);
      mounted.current = true;
    }, []),
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = q
      ? followsApi.searchUsers(q, controller.signal)
      : searchHistoryApi.list(controller.signal);
    request
      .then(users => {
        if (controller.signal.aborted) return;
        primeFollowStatuses(users);
        if (q) setResults(users);
        else setHistory(users);
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, attempt]);

  const open = (user: UserSummary) => {
    if (user.is_self) {
      navigation.navigate('Profile');
      return;
    }
    // Remember the visit; the list is re-fetched when the tab is focused again.
    searchHistoryApi.add(user.id).catch(() => {});
    navigation.navigate('UserProfile', { username: user.username });
  };

  const removeFromHistory = (user: UserSummary) => {
    const before = history;
    setHistory(h => h.filter(u => u.id !== user.id));
    searchHistoryApi.remove(user.id).catch(() => setHistory(before));
  };

  const clearHistory = () => {
    const before = history;
    setHistory([]);
    searchHistoryApi.clear().catch(() => setHistory(before));
  };

  const typing = query.trim() !== q;
  const showingHistory = !q && !typing;
  const people = q ? results : history;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search people"
      />
      <FlatList
        ref={listRef}
        data={loading || typing || error ? [] : people}
        keyExtractor={u => u.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        ListHeaderComponent={
          showingHistory && !loading && !error && history.length ? (
            <View style={styles.headingRow}>
              <Text style={[styles.heading, { color: colors.text }]}>
                Recent
              </Text>
              <Pressable
                onPress={clearHistory}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear all recent searches"
              >
                <Text style={[styles.clear, { color: colors.primary }]}>
                  Clear all
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() => open(item)}
            trailing={
              showingHistory ? (
                <Pressable
                  onPress={() => removeFromHistory(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.username} from recent searches`}
                  style={styles.remove}
                >
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              ) : item.is_self ? null : (
                <FollowButton user={item} status={item.follow_status} />
              )
            }
          />
        )}
        ListEmptyComponent={
          loading || typing ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <EmptyState
              icon={<SearchX size={34} color={colors.primary} />}
              title="Search isn't working"
              text={error}
              action={
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => setAttempt(a => a + 1)}
                  style={styles.retry}
                />
              }
            />
          ) : !q ? (
            <EmptyState
              icon={<Clock size={34} color={colors.primary} />}
              title="No recent searches"
              text="People you look up will show here."
            />
          ) : (
            <EmptyState
              icon={<SearchX size={34} color={colors.primary} />}
              title={`No results for "${q}"`}
              text="Check the spelling or try a different name."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  heading: { fontSize: 16, fontWeight: '800' },
  clear: { fontSize: 14, fontWeight: '700' },
  remove: { padding: 6 },
  loader: { marginTop: spacing.xl },
  retry: { minWidth: 180 },
});
