import { useScrollToTop } from '@react-navigation/native';
import { Bell, Camera, MessageCircle } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, type FlatListInstance, StyleSheet } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { BrandLogo } from '@/components/BrandLogo';
import {
  CommentsSheet,
  type CommentTarget,
} from '@/components/posts/CommentsSheet';
import { PostCard } from '@/components/posts/PostCard';
import { PostingBar } from '@/components/posts/PostingBar';
import { FeedSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { StoriesTray } from '@/components/stories/StoriesTray';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useChats } from '@/features/chats/useChats';
import { usePagedList } from '@/features/follows/usePagedList';
import { useNotifications } from '@/features/notifications/useNotifications';
import { onPostShared } from '@/features/posts/postComposer';
import { dropExpired } from '@/features/stories/expiry';
import { onStoryShared } from '@/features/stories/storyEvents';
import { useEngagementSync } from '@/features/posts/postEvents';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import type { Post } from '@/services/api/posts';
import { postsApi } from '@/services/api/posts';
import { type StoryGroup, storiesApi } from '@/services/api/stories';
import { useAppTheme } from '@/theme';

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { user } = useAuth();
  const { scheme, colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { unreadCount: unreadChats } = useChats();
  const listRef = useRef<FlatListInstance>(null);
  const [commentPost, setCommentPost] = useState<CommentTarget | null>(null);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [visibleId, setVisibleId] = useState<string | null>(null);
  useScrollToTop(listRef);
  // Same order as the tray: your story first, then everyone else.
  const trayOrder = useMemo(
    () => [
      ...stories.filter(s => s.user.is_self),
      ...stories.filter(s => !s.user.is_self),
    ],
    [stories],
  );
  useStatusBar();

  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.feed(cursor, signal),
    [],
  );
  const list = usePagedList<Post>(fetchPage);
  const { setItems } = list;
  useEngagementSync<Post>('post', setItems);

  const loadStories = useCallback(() => {
    storiesApi
      .tray()
      .then(groups => setStories(dropExpired(groups)))
      .catch(() => {});
  }, []);

  // Stories vanish from the tray when their 24 hours end, without a refresh.
  const viewing = storyIndex !== null;
  useEffect(() => {
    if (viewing) return;
    const timer = setInterval(() => setStories(dropExpired), 60_000);
    return () => clearInterval(timer);
  }, [viewing]);

  useEffect(() => {
    loadStories();
    const offPost = onPostShared(post => {
      setItems(prev => [post, ...prev.filter(p => p.id !== post.id)]);
      loadStories();
    });
    const offStory = onStoryShared(loadStories);
    return () => {
      offPost();
      offStory();
    };
  }, [loadStories, setItems]);

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
        left={<BrandLogo variant="horizontal" width={112} scheme={scheme} />}
        actions={
          <>
            <IconButton
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
              badge={unreadNotifications + (user?.follow_requests_count ?? 0)}
            >
              <Bell size={24} color={colors.text} />
            </IconButton>
            <IconButton
              onPress={() => navigation.navigate('Chats')}
              accessibilityLabel="Chats"
              badge={unreadChats}
            >
              <MessageCircle size={24} color={colors.text} />
            </IconButton>
            <IconButton
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Your profile"
              size={40}
              style={styles.me}
            >
              <Avatar
                uri={user?.avatar_url}
                name={user?.display_name ?? ''}
                size={34}
              />
            </IconButton>
          </>
        }
      />
      <PostingBar />
      <FlatList
        ref={listRef}
        data={list.items}
        keyExtractor={p => p.id}
        refreshing={list.refreshing}
        onRefresh={() => {
          list.refresh();
          loadStories();
        }}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={({ viewableItems }) =>
          setVisibleId(viewableItems[0]?.item.id ?? null)
        }
        contentContainerStyle={{ paddingBottom: bottomInset, flexGrow: 1 }}
        ListHeaderComponent={
          <StoriesTray
            groups={stories}
            onOpen={group => setStoryIndex(trayOrder.indexOf(group))}
            onCreate={() => navigation.navigate('CreateStory')}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            active={item.id === visibleId}
            onComment={() =>
              setCommentPost({
                kind: 'post',
                id: item.id,
                commentsDisabled: item.comments_disabled,
                isOwner: item.is_owner,
                commentsCount: item.comments_count,
              })
            }
            onDeleted={() =>
              setItems(prev => prev.filter(p => p.id !== item.id))
            }
          />
        )}
        ListFooterComponent={
          list.loadingMore ? <FeedSkeleton count={1} /> : undefined
        }
        ListEmptyComponent={
          list.loading ? (
            <FeedSkeleton />
          ) : (
            <EmptyState
              icon={<Camera size={34} color={colors.primary} />}
              title="Your feed is empty"
              text="Posts from people you follow will show up here."
              action={
                <Button
                  title="Create a post"
                  onPress={() => navigation.navigate('CreatePostCrop')}
                  style={styles.cta}
                />
              }
            />
          )
        }
      />
      <CommentsSheet
        target={commentPost}
        onClose={() => setCommentPost(null)}
      />
      <StoryViewer
        groups={trayOrder}
        startIndex={storyIndex}
        onChanged={loadStories}
        onClose={() => {
          setStoryIndex(null);
          loadStories();
        }}
      />
    </SafeAreaView>
  );
}

/** Keeps the same arrays when nothing expired, so the tray doesn't re-render. */
const styles = StyleSheet.create({
  safe: { flex: 1 },
  cta: { minWidth: 200 },
  me: { marginLeft: 2 },
});
