import { useNavigation } from '@react-navigation/native';
import { Layers, Play } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { usePagedList } from '@/features/follows/usePagedList';
import { onPostShared } from '@/features/posts/postComposer';
import { useEngagementSync } from '@/features/posts/postEvents';
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
  const size = (width - GAP * 2) / 3;
  const list = usePagedList(fetchPage);
  useEngagementSync<Post>('post', list.setItems);

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

  if (list.loading) {
    return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }
  if (!list.items.length) return <>{empty}</>;

  return (
    <View>
      <View style={styles.wrap}>
        {list.items.map(item => {
          const cover = item.media[0];
          return (
            <Pressable
              key={item.id}
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
              accessibilityLabel="Open post"
            >
              {cover ? (
                <Image source={{ uri: cover.url }} style={styles.fill} />
              ) : null}
              {item.media.length > 1 ? (
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
      {list.hasMore ? (
        <Button
          title={list.loadingMore ? 'Loading…' : 'Load more'}
          variant="secondary"
          onPress={list.loadMore}
          disabled={list.loadingMore}
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
  loader: { marginTop: spacing.lg },
  more: { margin: spacing.md },
});
