import { useNavigation } from '@react-navigation/native';
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  UserRound,
} from 'lucide-react-native';
import { memo, useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FilterFrame } from '@/components/create/FilterFrame';
import { formatCount } from '@/components/profile/ProfileParts';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { ShareSheet } from '@/components/share/ShareSheet';
import { Avatar } from '@/components/ui/Avatar';
import { setLikeState } from '@/features/posts/likeSync';
import { emitPostEvent } from '@/features/posts/postEvents';
import { ApiError } from '@/services/api/client';
import { type Post, postsApi } from '@/services/api/posts';
import { reelsApi } from '@/services/api/reels';
import { spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

import { CaptionText } from './CaptionText';
import { PlayableMedia } from './PlayableMedia';
import { PostOptionsSheet } from './PostOptionsSheet';

type Props = {
  post: Post;
  active?: boolean;
  onComment: () => void;
  onDeleted?: () => void;
};

const DOUBLE_TAP_MS = 300;

function PostCardBase({ post, active, onComment, onDeleted }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const height = width / (post.aspect_ratio || 1);
  const [index, setIndex] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [options, setOptions] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [sharing, setSharing] = useState(false);
  const saving = useRef(false);
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const kind = post.reel ? 'reel' : 'post';

  const like = useCallback(
    (liked: boolean) => {
      setLikeState(kind, post.id, post, liked);
      if (liked) {
        pop.setValue(0.7);
        Animated.spring(pop, {
          toValue: 1,
          friction: 3,
          tension: 180,
          useNativeDriver: true,
        }).start();
      }
    },
    [kind, post, pop],
  );

  const playBurst = () => {
    burst.stopAnimation();
    burst.setValue(0);
    Animated.timing(burst, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      playBurst();
      if (!post.liked_by_me) like(true);
    } else {
      lastTap.current = now;
    }
  };

  const syncIndex = (offsetX: number) => {
    const next = pageAt(offsetX, width, post.media.length);
    setIndex(prev => (prev === next ? prev : next));
  };

  const onCarouselScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
    }),
  ).current;

  const toggleSave = async () => {
    if (saving.current) return;
    saving.current = true;
    const next = !post.saved_by_me;
    emitPostEvent({
      type: 'patch',
      kind,
      id: post.id,
      patch: { saved_by_me: next },
    });
    try {
      const result =
        kind === 'reel' ? await reelsApi.save(post.id) : await postsApi.save(post.id);
      emitPostEvent({
        type: 'patch',
        kind,
        id: post.id,
        patch: { saved_by_me: result.saved },
      });
    } catch (err) {
      emitPostEvent({
        type: 'patch',
        kind,
        id: post.id,
        patch: { saved_by_me: !next },
      });
      Alert.alert(
        "Couldn't save",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      saving.current = false;
    }
  };

  const openUser = (username: string, isSelf?: boolean) =>
    isSelf
      ? navigation.navigate('Profile')
      : navigation.navigate('UserProfile', { username });

  const burstStyle = {
    opacity: burst.interpolate({
      inputRange: [0, 0.15, 0.7, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        scale: burst.interpolate({
          inputRange: [0, 0.2, 0.4, 1],
          outputRange: [0.3, 1.25, 1, 1.05],
        }),
      },
    ],
  };

  return (
    <View>
      <View style={styles.head}>
        <Pressable
          onPress={() => openUser(post.author.username, post.author.is_self)}
          style={styles.author}
          accessibilityRole="button"
          accessibilityLabel={`${post.author.username}'s profile`}
        >
          <Avatar
            uri={post.author.avatar_url}
            name={post.author.display_name}
            size={34}
          />
          <View style={styles.flex}>
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
          </View>
        </Pressable>
        <Pressable
          onPress={() => (post.is_owner ? setOptions(true) : setReporting(true))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <MoreHorizontal size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ height, backgroundColor: colors.surfaceAlt }}>
        <Animated.FlatList
          data={post.media}
          keyExtractor={(m: Post['media'][number]) => m.id}
          extraData={index}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onCarouselScroll}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            syncIndex(e.nativeEvent.contentOffset.x)
          }
          getItemLayout={(_: unknown, i: number) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={({
            item,
            index: i,
          }: {
            item: Post['media'][number];
            index: number;
          }) => (
            <Pressable onPress={onMediaPress} style={{ width, height }}>
              <FilterFrame adjustments={post.adjustments} style={{ width, height }}>
                <PlayableMedia
                  uri={item.url}
                  kind={item.kind}
                  active={!!active && i === index}
                  trimStartMs={post.reel?.trim_start_ms}
                  trimEndMs={post.reel?.trim_end_ms}
                  forceMuted={post.reel?.audio_muted}
                  blurRadius={Math.round((post.adjustments?.blur ?? 0) / 8)}
                  style={{ width, height }}
                  accessibilityLabel={item.alt_text || `Photo ${i + 1}`}
                />
              </FilterFrame>
            </Pressable>
          )}
        />
        {post.media.length > 1 ? (
          <PageCounter
            scrollX={scrollX}
            width={width}
            count={post.media.length}
          />
        ) : null}
        {post.tagged_users.length ? (
          <>
            <Pressable
              onPress={() => setShowTags(s => !s)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${post.tagged_users.length} tagged ${
                post.tagged_users.length === 1 ? 'person' : 'people'
              }`}
              style={styles.tagButton}
            >
              <UserRound size={15} color="#FFFFFF" />
            </Pressable>
            {showTags ? (
              <View style={styles.tagList}>
                {post.tagged_users.map(u => (
                  <Pressable
                    key={u.id}
                    onPress={() => openUser(u.username, u.is_self)}
                    style={styles.tagPill}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${u.username}`}
                  >
                    <Text style={styles.tagText}>{u.username}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        <View pointerEvents="none" style={styles.burstWrap}>
          <Animated.View style={burstStyle}>
            <Heart size={96} color="#FFFFFF" fill="#FFFFFF" />
          </Animated.View>
        </View>
      </View>

      {post.media.length > 1 ? (
        <View style={styles.dots}>
          {post.media.map((m, i) => (
            <View
              key={m.id}
              style={[styles.dot, { backgroundColor: colors.border }]}
            >
              <Animated.View
                style={[
                  styles.dotFill,
                  {
                    backgroundColor: colors.primary,
                    opacity: scrollX.interpolate({
                      inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                      outputRange: [0, 1, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => like(!post.liked_by_me)}
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: post.liked_by_me }}
          hitSlop={6}
        >
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Heart
              size={26}
              color={post.liked_by_me ? colors.like : colors.text}
              fill={post.liked_by_me ? colors.like : 'transparent'}
            />
          </Animated.View>
        </Pressable>
        {post.comments_disabled ? null : (
          <Pressable
            onPress={onComment}
            accessibilityRole="button"
            accessibilityLabel="Comments"
            hitSlop={6}
          >
            <MessageCircle size={26} color={colors.text} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setSharing(true)}
          accessibilityRole="button"
          accessibilityLabel="Share"
          hitSlop={6}
        >
          <Send size={24} color={colors.text} />
        </Pressable>
        <View style={styles.flex} />
        <Pressable
          onPress={toggleSave}
          accessibilityRole="button"
          accessibilityLabel={post.saved_by_me ? 'Remove from saved' : 'Save'}
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
      {!post.comments_disabled && post.comments_count > 0 ? (
        <Pressable
          onPress={onComment}
          style={styles.viewComments}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            View all {post.comments_count} comment
            {post.comments_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.time, { color: colors.textSecondary }]}>
        {timeAgo(new Date(post.created_at).getTime())}
      </Text>

      <PostOptionsSheet
        target={
          options
            ? {
                kind,
                id: post.id,
                caption: post.caption,
                hide_like_count: post.hide_like_count,
                comments_disabled: post.comments_disabled,
              }
            : null
        }
        onClose={() => setOptions(false)}
        onDeleted={onDeleted}
      />
      <ReportSheet
        visible={reporting}
        targetType={kind}
        targetId={post.id}
        blockUserId={post.is_owner ? undefined : post.author.id}
        username={post.author.username}
        onClose={() => setReporting(false)}
        onBlocked={onDeleted}
      />
      <ShareSheet
        target={
          sharing
            ? {
                kind,
                id: post.id,
                media_index: index,
                preview: {
                  url: (post.media[index] ?? post.media[0])?.url ?? '',
                  video: (post.media[index] ?? post.media[0])?.kind === 'video',
                  username: post.author.username,
                  avatar_url: post.author.avatar_url ?? null,
                  caption: post.caption ?? '',
                  aspect_ratio: post.aspect_ratio,
                },
              }
            : null
        }
        onClose={() => setSharing(false)}
      />
    </View>
  );
}

function pageAt(offsetX: number, width: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.round(offsetX / width)));
}

function PageCounter({
  scrollX,
  width,
  count,
}: {
  scrollX: Animated.Value;
  width: number;
  count: number;
}) {
  return (
    <View style={styles.counter} pointerEvents="none">
      <Text style={[styles.counterText, styles.hidden]}>
        {count}/{count}
      </Text>
      {Array.from({ length: count }, (_, i) => {
        const start = (i - 0.5) * width;
        const end = (i + 0.5) * width;
        const opacity =
          count === 1
            ? 1
            : scrollX.interpolate({
                inputRange:
                  i === 0
                    ? [end - 1, end]
                    : i === count - 1
                      ? [start - 1, start]
                      : [start - 1, start, end - 1, end],
                outputRange:
                  i === 0 ? [1, 0] : i === count - 1 ? [0, 1] : [0, 1, 1, 0],
                extrapolate: 'clamp',
              });
        return (
          <Animated.Text
            key={i}
            style={[styles.counterText, styles.counterLabel, { opacity }]}
          >
            {i + 1}/{count}
          </Animated.Text>
        );
      })}
    </View>
  );
}

export const PostCard = memo(PostCardBase);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { fontSize: 14, fontWeight: '700' },
  location: { fontSize: 12 },
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
  counterLabel: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  hidden: { opacity: 0 },
  tagButton: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tagList: {
    position: 'absolute',
    left: 12,
    right: 56,
    bottom: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  burstWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, overflow: 'hidden' },
  dotFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
  },
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
