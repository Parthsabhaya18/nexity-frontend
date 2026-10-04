import { useCallback, useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/posts/CommentsSheet';
import { PostCard } from '@/components/posts/PostCard';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/services/api/client';
import { type Post, postsApi } from '@/services/api/posts';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { useAppTheme } from '@/theme';

export function PostDetailScreen({
  route,
  navigation,
}: ScreenProps<'PostDetail'>) {
  const { colors } = useAppTheme();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  useStatusBar();

  const load = useCallback(() => {
    setError(null);
    postsApi
      .get(route.params.postId)
      .then(setPost)
      .catch(err =>
        setError(
          err instanceof ApiError ? err.message : 'This post is unavailable.',
        ),
      );
  }, [route.params.postId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Post" back />
      {!post && !error ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error || !post ? (
        <EmptyState
          icon={<ImageOff size={34} color={colors.primary} />}
          title="Post unavailable"
          text={error ?? 'This post is no longer available.'}
          action={
            <Button title="Try again" variant="secondary" onPress={load} />
          }
        />
      ) : (
        <View>
          <PostCard
            post={post}
            active
            onChange={setPost}
            onComment={() => setComments(true)}
            onDeleted={() => navigation.goBack()}
          />
        </View>
      )}
      <CommentsSheet
        post={comments ? post : null}
        onClose={() => setComments(false)}
        onCount={count => post && setPost({ ...post, comments_count: count })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { marginTop: 32 },
});
