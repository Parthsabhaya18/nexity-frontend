import { ImageOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CommentsSheet,
  type CommentTarget,
} from '@/components/posts/CommentsSheet';
import { PostCard } from '@/components/posts/PostCard';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEngagementSync } from '@/features/posts/postEvents';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { type Post, postsApi } from '@/services/api/posts';
import { useAppTheme } from '@/theme';

const MAX_PAGES_TO_FIND = 12;

/**
 * One post per page; swipe left/right to move between the posts of the
 * profile (or the saved list) it was opened from.
 */
export function PostViewerScreen({
  route,
  navigation,
}: ScreenProps<'PostViewer'>) {
  const { postId, source, userId } = route.params;
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Post[]>([]);
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [comments, setComments] = useState<CommentTarget | null>(null);
  const cursor = useRef<string | null>(null);
  const loadingMore = useRef(false);
  const list = useRef<FlatList<Post>>(null);
  useStatusBar();
  useEngagementSync<Post>('post', setItems);

  const fetchPage = useCallback(
    (c: string | null) =>
      source === 'saved' ? postsApi.saved(c) : postsApi.byUser(userId!, c),
    [source, userId],
  );

  const load = useCallback(async () => {
    setError(null);
    setStartIndex(null);
    try {
      let all: Post[] = [];
      let next: string | null = null;
      for (let i = 0; i < MAX_PAGES_TO_FIND; i += 1) {
        const page = await fetchPage(next);
        all = all.concat(page.items);
        next = page.next_cursor;
        if (all.some(p => p.id === postId) || !next) break;
      }
      let at = all.findIndex(p => p.id === postId);
      if (at < 0) {
        // Opened from somewhere the list doesn't reach; show the post alone first.
        all = [await postsApi.get(postId), ...all];
        at = 0;
      }
      cursor.current = next;
      setItems(all);
      setIndex(at);
      setStartIndex(at);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'This post is unavailable.',
      );
    }
  }, [fetchPage, postId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (startIndex !== null && items.length === 0) navigation.goBack();
  }, [items.length, navigation, startIndex]);

  const loadMore = async () => {
    if (!cursor.current || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await fetchPage(cursor.current);
      cursor.current = page.next_cursor;
      setItems(prev => [
        ...prev,
        ...page.items.filter(n => !prev.some(p => p.id === n.id)),
      ]);
    } catch {
      // The next swipe to the end retries.
    } finally {
      loadingMore.current = false;
    }
  };

  const current = items[index];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar
        title={source === 'saved' ? 'Saved' : 'Posts'}
        subtitle={
          items.length > 1 && startIndex !== null
            ? `${Math.min(index + 1, items.length)} of ${items.length}${
                cursor.current ? '+' : ''
              }`
            : undefined
        }
        back
      />
      {error ? (
        <EmptyState
          icon={<ImageOff size={34} color={colors.primary} />}
          title="Post unavailable"
          text={error}
          action={<Button title="Try again" variant="secondary" onPress={load} />}
        />
      ) : startIndex === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={p => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndex(i);
            if (i >= items.length - 3) loadMore();
          }}
          renderItem={({ item, index: i }) => (
            <View style={{ width }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <PostCard
                  post={item}
                  active={i === index}
                  onComment={() =>
                    setComments({
                      kind: 'post',
                      id: item.id,
                      commentsDisabled: item.comments_disabled,
                      isOwner: item.is_owner,
                      commentsCount: item.comments_count,
                    })
                  }
                />
              </ScrollView>
            </View>
          )}
        />
      )}
      <CommentsSheet
        target={
          comments && current && comments.id === current.id
            ? {
                ...comments,
                commentsDisabled: current.comments_disabled,
                commentsCount: current.comments_count,
              }
            : comments
        }
        onClose={() => setComments(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { marginTop: 32 },
});
