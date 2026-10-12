import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Eye, Heart } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCount } from '@/components/profile/ProfileParts';
import { FollowButton } from '@/components/follows/FollowButton';
import { PlanBadge } from '@/components/profile/PlanBadge';
import { StoryRingAvatar, useStoryRings } from '@/components/stories/StoryRingAvatar';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetFlatList } from '@/components/ui/sheetDrag';
import { SearchField } from '@/components/ui/SearchField';
import type { RootStackParamList } from '@/navigation/types';
import type { Page, UserSummary } from '@/services/api/follows';
import type { StoryGroup } from '@/services/api/stories';
import { spacing, useAppTheme } from '@/theme';

export function LikesSheet({
  open,
  kind,
  likesCount,
  playsCount,
  load,
  onClose,
}: {
  open: boolean;
  kind: 'post' | 'reel';
  likesCount: number | null;
  playsCount?: number | null;
  load: (cursor: string | null, signal: AbortSignal) => Promise<Page<UserSummary>>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<UserSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { stories, reload: reloadStories, markSeen } = useStoryRings(open);
  const [watching, setWatching] = useState<StoryGroup | null>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setWatching(null);
      return;
    }
    const controller = new AbortController();
    setItems(null);
    setCursor(null);
    load(null, controller.signal)
      .then(page => {
        if (controller.signal.aborted) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [open, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return items ?? [];
    return (items ?? []).filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q),
    );
  }, [items, query]);

  const loadMore = () => {
    if (!cursor || loadingMore.current || query.trim()) return;
    loadingMore.current = true;
    const controller = new AbortController();
    load(cursor, controller.signal)
      .then(page => {
        setItems(prev => [...(prev ?? []), ...page.items]);
        setCursor(page.next_cursor);
      })
      .catch(() => {})
      .finally(() => {
        loadingMore.current = false;
      });
  };

  const openProfile = (user: UserSummary) => {
    onClose();
    if (user.is_self) navigation.navigate('Profile');
    else navigation.navigate('UserProfile', { username: user.username });
  };

  const reel = kind === 'reel';

  return (
    <>
      <BottomSheet visible={open} onClose={onClose} style={styles.sheet}>
        <View style={styles.fill}>
          <Text style={[styles.title, { color: colors.text }]}>
            {reel ? 'Likes and plays' : 'Likes'}
          </Text>
          <View style={styles.counts}>
            {likesCount !== null ? (
              <View style={styles.count}>
                <Heart size={16} color={colors.text} />
                <Text style={[styles.countText, { color: colors.text }]}>
                  {formatCount(likesCount)}
                </Text>
              </View>
            ) : null}
            {reel && playsCount != null ? (
              <View style={styles.count}>
                <Eye size={16} color={colors.text} />
                <Text style={[styles.countText, { color: colors.text }]}>
                  {formatCount(playsCount)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.section, { color: colors.text }]}>Liked by</Text>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search"
            style={styles.search}
          />
          <SheetFlatList
            data={shown}
            keyExtractor={item => item.id}
            style={styles.flex}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              items === null ? (
                <UserListSkeleton rows={7} avatar={44} button rowStyle={styles.row} />
              ) : (
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  {query.trim() ? 'No one matches that search' : 'No likes yet'}
                </Text>
              )
            }
            renderItem={({ item }) => {
              const story = stories.get(item.id);
              return (
                <View style={styles.row}>
                  <StoryRingAvatar
                    story={story}
                    uri={item.avatar_url}
                    name={item.display_name}
                    size={44}
                    onPress={() => (story ? setWatching(story) : openProfile(item))}
                    label={
                      story
                        ? `View @${item.username}'s story`
                        : `@${item.username}'s profile`
                    }
                  />
                  <Pressable
                    style={styles.person}
                    onPress={() => openProfile(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.display_name}, @${item.username}`}
                  >
                    <View style={styles.meta}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                          {item.username}
                        </Text>
                        <PlanBadge plan={item.plan_badge} />
                      </View>
                      <Text
                        style={[styles.name, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {item.display_name}
                      </Text>
                    </View>
                  </Pressable>
                  {item.is_self ? null : (
                    <FollowButton user={item} status={item.follow_status} />
                  )}
                </View>
              );
            }}
          />
        </View>
      </BottomSheet>
      <StoryViewer
        groups={watching ? [watching] : []}
        startIndex={watching ? 0 : null}
        onClose={() => {
          const id = watching?.user.id;
          setWatching(null);
          if (id) markSeen(id);
          reloadStories();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { height: '78%', overflow: 'hidden' },
  fill: { flex: 1 },
  flex: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  counts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: 10,
    marginBottom: 14,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { fontSize: 15, fontWeight: '700' },
  section: {
    fontSize: 15,
    fontWeight: '800',
    marginHorizontal: spacing.md,
    marginBottom: 8,
  },
  search: { marginHorizontal: spacing.md, marginBottom: 6 },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  empty: { textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  person: { flex: 1, minWidth: 0 },
  meta: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontWeight: '700', fontSize: 14, flexShrink: 1 },
  name: { fontSize: 13, marginTop: 1 },
});
