import { ChevronRight, CloudOff, Heart, Users, VenetianMask, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SearchField } from '@/components/ui/SearchField';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCrushList, useCrushMatches } from '@/features/crush/crushQueries';
import { useCrushActions } from '@/features/crush/useCrushActions';
import { useSecretSent } from '@/features/secret/secretQueries';
import { useStartSecret } from '@/features/secret/useStartSecret';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { type ChatUser, chatApi } from '@/services/api/chat';
import { ApiError } from '@/services/api/client';
import { radius, spacing, useAppTheme } from '@/theme';

const SEARCH_DEBOUNCE_MS = 250;

export function SecretPeoplePickerScreen({
  navigation,
  route,
}: ScreenProps<'SecretPeoplePicker'>) {
  const { colors } = useAppTheme();
  const { user: me } = useAuth();
  const forCrush = route.params?.intent === 'crush';
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sent = useSecretSent().data?.data;
  const start = useStartSecret();
  const crush = useCrushActions({ replace: true });
  const crushes = useCrushList().data?.data;
  const matches = useCrushMatches().data?.data;
  useStatusBar();

  const crushTags = useMemo(() => {
    const tags = new Map<string, string>();
    (crushes ?? []).forEach(c => tags.set(c.user.id, 'In your crushes'));
    (matches ?? []).forEach(m => tags.set(m.user.id, 'Matched 💘'));
    return tags;
  }, [crushes, matches]);

  const q = query.trim().replace(/^@/, '');
  const openTo = useMemo(
    () =>
      new Set(
        (sent ?? [])
          .filter(t => t.status === 'sealed' && t.recipient)
          .map(t => t.recipient!.id),
      ),
    [sent],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const found = await chatApi.searchUsers(q);
          if (!cancelled) {
            setPeople(found.filter(p => p.id !== me?.id));
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : 'Could not search.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      q ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, me?.id]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar
        title={forCrush ? 'Add a Secret Crush' : 'Send a Secret Message'}
        actions={
          <IconButton onPress={() => navigation.goBack()} accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </IconButton>
        }
      />
      <View style={[styles.intro, { backgroundColor: colors.primarySofter }]}>
        {forCrush ? (
          <Heart size={18} color={colors.primary} />
        ) : (
          <VenetianMask size={18} color={colors.primary} />
        )}
        {forCrush ? (
          <Text style={[styles.introText, { color: colors.text }]}>
            Pick anyone — public or private. They'll only know it's you{' '}
            <Text style={styles.bold}>if they add you too</Text>.
          </Text>
        ) : (
          <Text style={[styles.introText, { color: colors.text }]}>
            Pick anyone — public or private. You stay{' '}
            <Text style={styles.bold}>"Someone"</Text> until they reply twice.
          </Text>
        )}
      </View>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by name or username"
        autoFocus
        style={styles.search}
      />
      <FlatList
        data={people}
        keyExtractor={p => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          !q && people.length ? (
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              Suggested
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const tag = forCrush
            ? crushTags.get(item.id) ?? null
            : openTo.has(item.id)
            ? 'Open thread'
            : null;
          return (
            <Pressable
              onPress={() =>
                forCrush
                  ? tag
                    ? showToast(
                        tag === 'Matched 💘'
                          ? "You're already matched 💘"
                          : "They're already in your Secret Crushes.",
                        'info',
                      )
                    : crush.add(item)
                  : start.toUser(item, { replace: true })
              }
              accessibilityRole="button"
              accessibilityLabel={`${forCrush ? 'Add as a Secret Crush' : 'Send a Secret Message to'} ${
                item.display_name
              }${tag ? `. ${tag}` : ''}`}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Avatar uri={item.avatar_url} name={item.display_name} size={46} />
              <View style={styles.rowText}>
                <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                  {item.username}
                </Text>
                <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.display_name}
                </Text>
              </View>
              {tag ? (
                <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                </View>
              ) : (
                <ChevronRight size={18} color={colors.textSecondary} />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <UserListSkeleton avatar={46} rowStyle={[styles.row, styles.skeletonRow]} />
          ) : error ? (
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title="Couldn't load people"
              text={error}
            />
          ) : (
            <EmptyState
              icon={<Users size={34} color={colors.primary} />}
              title={q ? 'No people found' : 'No one here yet'}
              text={q ? `No one matches "${q}".` : 'When more people join Nexity, they show up here.'}
            />
          )
        }
      />
      {start.limitDialog}
      {crush.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bold: { fontWeight: '800' },
  intro: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginHorizontal: spacing.md,
    padding: 12,
    borderRadius: radius.md,
  },
  introText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  search: { marginHorizontal: spacing.md, marginTop: 10, marginBottom: 6 },
  content: { flexGrow: 1, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg },
  section: {
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
    marginTop: 4,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, minWidth: 0 },
  username: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 13, marginTop: 1 },
  tag: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  skeletonRow: { minHeight: 62 },
});
