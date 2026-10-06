import { useNavigation } from '@react-navigation/native';
import { Clapperboard, Layers, Play } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { usePagedList } from '@/features/follows/usePagedList';
import { onPostShared } from '@/features/posts/postComposer';
import { ReelCover } from '@/components/reels/ReelGrid';
import { PostGridSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { useSavedEngagementSync } from '@/features/posts/postEvents';
import type { Page, Post } from '@/services/api/posts';
import { spacing, useAppTheme } from '@/theme';

const GAP = 2;

/** Where the grid's posts come from, so the viewer can page through the same list. */
export type PostSource = { source: 'user'; userId: string } | { source: 'saved' };

/**
 * 3-column grid meant to sit inside a parent scroll view. `fetchPage` must be
 * stable (wrap it in useCallback) or the list reloads on every render.
 */
export function PostGrid({
  fetchPage,
  empty,
  from,
}: {
  fetchPage: (
    cursor: string | null,
    signal: AbortSignal,
  ) => Promise<Page<Post>>;
  empty: ReactNode;
  from: PostSource;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(width);
  // Rounded down: three tiles that add up to even a fraction over the row wrap to two columns.
  const size = Math.floor((gridWidth - GAP * 2) / 3);
  const list = usePagedList(fetchPage);
  useSavedEngagementSync(list.setItems);

  // A post shared from the create flow shows up on the author's own grid.
  const { setItems } = list;
  const authorId = from.source === 'user' ? from.userId : null;
  useEffect(
    () =>
      onPostShared(post => {
        if (post.author.id === authorId) {
          setItems(prev => [post, ...prev.filter(p => p.id !== post.id)]);
        }
      }),
    [authorId, setItems],
  );

  if (list.loading) return <PostGridSkeleton size={size} />;
  if (!list.items.length) return <>{empty}</>;

  return (
    <View onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
      <View style={styles.wrap}>
        {list.items.map(item => {
          const cover = item.media[0];
          return (
            <Pressable
              key={item.reel ? `reel:${item.id}` : item.id}
              onPress={() =>
                navigation.navigate('PostViewer', {
                  postId: item.id,
                  ...from,
                })
              }
              style={{
                width: size,
                height: size,
                overflow: 'hidden',
                backgroundColor: colors.surfaceAlt,
              }}
              accessibilityRole="button"
              accessibilityLabel={item.reel ? 'Open reel' : 'Open post'}
            >
              {item.reel ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <ReelCover reel={item.reel} />
                </View>
              ) : cover ? (
                <Image source={{ uri: cover.url }} style={styles.fill} />
              ) : null}
              {item.reel ? (
                <View style={styles.badge}>
                  <Clapperboard size={16} color="#FFFFFF" />
                </View>
              ) : item.media.length > 1 ? (
                <View style={styles.badge}>
                  <Layers size={16} color="#FFFFFF" />
                </View>
              ) : cover?.kind === 'video' ? (
                <View style={styles.badge}>
                  <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {list.loadingMore ? (
        <View style={styles.moreSkeleton}>
          <PostGridSkeleton size={size} count={3} />
        </View>
      ) : list.hasMore ? (
        <Button
          title="Load more"
          variant="secondary"
          onPress={list.loadMore}
          style={styles.more}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  fill: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 6, right: 6 },
  moreSkeleton: { marginTop: GAP },
  more: { margin: spacing.md },
});
