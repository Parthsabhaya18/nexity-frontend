import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { SearchX, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type FlatListInstance,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

export function SearchScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const bottomInset = useTabBarInset();
  const listRef = useRef<FlatListInstance>(null);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 300);
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useScrollToTop(listRef);
  useStatusBar();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = q
      ? followsApi.searchUsers(q, controller.signal)
      : followsApi.suggestUsers(controller.signal);
    request
      .then(users => {
        primeFollowStatuses(users);
        if (q) setResults(users);
        else setSuggestions(users);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, attempt]);

  const typing = query.trim() !== q;
  const people = q ? results : suggestions;

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
          !q && !loading && !error && people.length ? (
            <Text style={[styles.heading, { color: colors.textSecondary }]}>
              Suggested for you
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() =>
              item.is_self
                ? navigation.navigate('Profile')
                : navigation.navigate('UserProfile', {
                    username: item.username,
                  })
            }
            trailing={
              item.is_self ? null : (
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
              icon={<Users size={34} color={colors.primary} />}
              title="No suggestions yet"
              text="Search by name or username to find someone."
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
  heading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  loader: { marginTop: spacing.xl },
  retry: { minWidth: 180 },
});
