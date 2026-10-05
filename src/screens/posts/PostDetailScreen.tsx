import { ImageOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

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

/** A single post, opened from a notification or a link. */
export function PostDetailScreen({
  route,
  navigation,
}: ScreenProps<'PostDetail'>) {
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState(false);
  const post = posts[0];
  useStatusBar();
  useEngagementSync<Post>('post', setPosts);

  const load = useCallback(() => {
    setError(null);
    setLoaded(false);
    postsApi
      .get(route.params.postId)
      .then(p => {
        setPosts([p]);
        setLoaded(true);
      })
      .catch(err =>
        setError(
          err instanceof ApiError ? err.message : 'This post is unavailable.',
        ),
      );
  }, [route.params.postId]);

  useEffect(() => {
    load();
  }, [load]);

  // Deleted from the options sheet.
  useEffect(() => {
    if (loaded && !post) navigation.goBack();
  }, [loaded, post, navigation]);

  const target: CommentTarget | null =
    comments && post
      ? {
          kind: 'post',
          id: post.id,
          commentsDisabled: post.comments_disabled,
          isOwner: post.is_owner,
          commentsCount: post.comments_count,
        }
      : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Post" back />
      {error ? (
        <EmptyState
          icon={<ImageOff size={34} color={colors.primary} />}
          title="Post unavailable"
          text={error}
          action={<Button title="Try again" variant="secondary" onPress={load} />}
        />
      ) : !post ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView>
          <PostCard post={post} active onComment={() => setComments(true)} />
        </ScrollView>
      )}
      <CommentsSheet target={target} onClose={() => setComments(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { marginTop: 32 },
});
