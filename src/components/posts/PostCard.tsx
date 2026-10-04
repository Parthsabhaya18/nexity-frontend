import { useNavigation } from '@react-navigation/native';
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music,
  Send,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatCount } from '@/components/profile/ProfileParts';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { ApiError } from '@/services/api/client';
import { type Post, postsApi } from '@/services/api/posts';
import { spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

import { FilterFrame } from '@/components/create/FilterFrame';
import { LookTint } from '@/components/media/LookStrip';

import { CaptionText } from './CaptionText';
import { PlayableMedia } from './PlayableMedia';

type Props = {
  post: Post;
  active?: boolean;
  onChange: (post: Post) => void;
  onComment: () => void;
  onDeleted?: () => void;
};

export function PostCard({
  post,
  active,
  onChange,
  onComment,
  onDeleted,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const height = width / (post.aspect_ratio || 1);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const lastTap = useRef(0);

  const run = async (action: 'like' | 'save') => {
    if (busy) return;
    const prev = post;
    const optimistic =
      action === 'like'
        ? {
            ...post,
            liked_by_me: !post.liked_by_me,
            likes_count:
              post.likes_count === null
                ? null
                : post.likes_count + (post.liked_by_me ? -1 : 1),
          }
        : { ...post, saved_by_me: !post.saved_by_me };
    onChange(optimistic);
    setBusy(true);
    try {
      const result =
        action === 'like'
          ? await postsApi.like(post.id)
          : await postsApi.save(post.id);
      onChange(result.post);
    } catch (err) {
      onChange(prev);
      Alert.alert(
        "Couldn't update",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!post.liked_by_me) run('like');
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const menu = () => {
    if (!post.is_owner) {
      setReporting(true);
      return;
    }
    Alert.alert(post.author.username, undefined, [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsApi.remove(post.id);
            onDeleted?.();
          } catch (err) {
            Alert.alert(
              "Couldn't delete",
              err instanceof ApiError ? err.message : 'Please try again.',
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openAuthor = () =>
    post.author.is_self
      ? navigation.navigate('Profile')
      : navigation.navigate('UserProfile', { username: post.author.username });

  return (
    <View>
      <View style={styles.head}>
        <Pressable
          onPress={openAuthor}
          style={styles.author}
          accessibilityRole="button"
        >
          <Avatar
            uri={post.author.avatar_url}
            name={post.author.display_name}
            size={34}
          />
          <View>
            <Text style={[styles.username, { color: colors.text }]}>
              {post.author.username}
            </Text>
            {post.location_name ? (
              <Text
                style={[styles.location, { color: colors.text }]}
                numberOfLines={1}
              >
                {post.location_name}
              </Text>
            ) : null}
            {post.music_title ? (
              <View style={styles.musicLine}>
                <Music size={12} color={colors.textSecondary} />
                <Text
                  style={[styles.location, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {post.music_title}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={menu} hitSlop={8} accessibilityLabel="Post options">
          <MoreHorizontal size={22} color={colors.text} />
        </Pressable>
      </View>

      <Pressable
        onPress={onMediaPress}
        style={{ height, backgroundColor: colors.surfaceAlt }}
      >
        <FlatList
          data={post.media}
          keyExtractor={m => m.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: i }) => (
            <FilterFrame
              adjustments={post.adjustments}
              style={{ width, height }}
            >
              <PlayableMedia
                uri={item.url}
                kind={item.kind}
                active={!!active && i === index}
                blurRadius={Math.round((post.adjustments?.blur ?? 0) / 8)}
                style={{ width, height }}
                accessibilityLabel={item.alt_text || `Photo ${i + 1}`}
              />
              <LookTint id={item.filter} />
            </FilterFrame>
          )}
        />
        {post.media.length > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1}/{post.media.length}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {post.media.length > 1 ? (
        <View style={styles.dots}>
          {post.media.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => run('like')}
          accessibilityLabel="Like"
          hitSlop={6}
        >
          <Heart
            size={26}
            color={post.liked_by_me ? colors.like : colors.text}
            fill={post.liked_by_me ? colors.like : 'transparent'}
          />
        </Pressable>
        <Pressable onPress={onComment} accessibilityLabel="Comment" hitSlop={6}>
          <MessageCircle size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() =>
            Share.share({
              message: `https://nexity.com/posts/${post.id}`,
            }).catch(() => {})
          }
          accessibilityLabel="Share"
          hitSlop={6}
        >
          <Send size={24} color={colors.text} />
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => run('save')}
          accessibilityLabel="Save"
          hitSlop={6}
        >
          <Bookmark
            size={26}
            color={colors.text}
            fill={post.saved_by_me ? colors.text : 'transparent'}
          />
        </Pressable>
      </View>

      {post.likes_count !== null && post.likes_count > 0 ? (
        <Text style={[styles.likes, { color: colors.text }]}>
          {formatCount(post.likes_count)} like
          {post.likes_count === 1 ? '' : 's'}
        </Text>
      ) : null}
      {post.caption ? (
        <View style={styles.caption}>
          <CaptionText username={post.author.username} caption={post.caption} />
        </View>
      ) : null}
      {post.comments_count > 0 ? (
        <Pressable onPress={onComment} style={styles.viewComments}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            View all {post.comments_count} comment
            {post.comments_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.time, { color: colors.textSecondary }]}>
        {timeAgo(new Date(post.created_at).getTime())}
      </Text>
      <ReportSheet
        visible={reporting}
        targetType="post"
        targetId={post.id}
        blockUserId={post.is_owner ? undefined : post.author.id}
        username={post.author.username}
        onClose={() => setReporting(false)}
        onBlocked={onDeleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { fontSize: 14, fontWeight: '700' },
  location: { fontSize: 12 },
  musicLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
  },
  spacer: { flex: 1 },
  likes: {
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: spacing.sm,
    marginTop: 6,
  },
  caption: { paddingHorizontal: spacing.sm, marginTop: 4 },
  viewComments: { paddingHorizontal: spacing.sm, marginTop: 4 },
  time: {
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    marginTop: 6,
    marginBottom: 12,
  },
});
