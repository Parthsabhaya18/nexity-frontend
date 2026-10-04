import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { LookTint } from '@/components/media/LookStrip';
import { Button } from '@/components/ui/Button';
import { usePagedList } from '@/features/follows/usePagedList';
import type { Page, Post } from '@/services/api/posts';
import { spacing, useAppTheme } from '@/theme';

const GAP = 2;

/**
 * 3-column grid meant to sit inside a parent scroll view. `fetchPage` must be
 * stable (wrap it in useCallback) or the list reloads on every render.
 */
export function PostGrid({
  fetchPage,
  empty,
}: {
  fetchPage: (
    cursor: string | null,
    signal: AbortSignal,
  ) => Promise<Page<Post>>;
  empty: ReactNode;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const size = (width - GAP * 2) / 3;
  const list = usePagedList(fetchPage);

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
                navigation.navigate('PostDetail', { postId: item.id })
              }
              style={{ width: size, height: size, overflow: 'hidden' }}
              accessibilityRole="button"
              accessibilityLabel="Open post"
            >
              {cover ? (
                <Image source={{ uri: cover.url }} style={styles.fill} />
              ) : null}
              <LookTint id={cover?.filter} />
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
  loader: { marginTop: spacing.lg },
  more: { margin: spacing.md },
});
