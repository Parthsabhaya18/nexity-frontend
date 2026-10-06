import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  Clapperboard,
  Heart,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';

import {
  CommentsSheet,
  type CommentTarget,
} from '@/components/posts/CommentsSheet';
import { CaptionText } from '@/components/posts/CaptionText';
import { PostOptionsSheet } from '@/components/posts/PostOptionsSheet';
import { formatCount } from '@/components/profile/ProfileParts';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { usePagedList } from '@/features/follows/usePagedList';
import { setLikeState } from '@/features/posts/likeSync';
import { useEngagementSync } from '@/features/posts/postEvents';
import { consumeFocusedReel, keepPinnedFirst } from '@/features/reels/reelFocus';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { type Reel, reelsApi } from '@/services/api/reels';

// Reels always play full-screen on black, like the camera.
const WHITE = '#FFFFFF';
const LIKE = '#FF3B5C';
const DOUBLE_TAP_MS = 260;
const CONTROLS_MS = 1500;

export function ReelsScreen({ navigation }: TabScreenProps<'Reels'>) {
  const bottomInset = useTabBarInset();
  const focused = useIsFocused();
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [comments, setComments] = useState<CommentTarget | null>(null);
  const [options, setOptions] = useState<Reel | null>(null);
  const [report, setReport] = useState<Reel | null>(null);
  const pinned = useRef<Reel | null>(null);
  const listRef = useRef<FlatList<Reel>>(null);
  useStatusBar('dark');

  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) => reelsApi.feed(cursor, signal),
    [],
  );
  const list = usePagedList<Reel>(fetchPage);
  const { items, setItems } = list;
  useEngagementSync<Reel>('reel', setItems);

  useEffect(() => {
    if (!activeId && items[0]) setActiveId(items[0].id);
    if (activeId && items.length && !items.some(r => r.id === activeId)) {
      setActiveId(items[0]?.id ?? null);
    }
  }, [items, activeId]);

  useFocusEffect(
    useCallback(() => {
      const focus = consumeFocusedReel();
      if (!focus) return;
      const open = (reel: Reel) => {
        pinned.current = reel;
        setItems(prev => [reel, ...prev.filter(item => item.id !== reel.id)]);
        setActiveId(reel.id);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      };
      if ('video_url' in focus) {
        open(focus);
        return;
      }
      // Only the id is known (a notification): the random feed may not contain it.
      const controller = new AbortController();
      reelsApi
        .get(focus.id, controller.signal)
        .then(open)
        .catch(() => {});
      return () => controller.abort();
    }, [setItems]),
  );

  // A reel opened from a profile stays first even when the (random) feed page
  // arrives afterwards and replaces the list, and is never shown twice.
  useEffect(() => {
    const pin = pinned.current;
    if (!pin || list.loading) return;
    const next = keepPinnedFirst(items, pin);
    if (!next) return;
    setItems(next);
    if (items[0]?.id !== pin.id) {
      setActiveId(pin.id);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [items, list.loading, setItems]);

  const refresh = useCallback(() => {
    pinned.current = null;
    list.refresh();
  }, [list]);

  const openComments = useCallback((reel: Reel) => {
    setComments({
      kind: 'reel',
      id: reel.id,
      commentsDisabled: reel.comments_disabled,
      isOwner: reel.is_owner,
      commentsCount: reel.comments_count,
    });
  }, []);

  const openMenu = useCallback((reel: Reel) => {
    if (reel.is_owner) setOptions(reel);
    else setReport(reel);
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  const optionsReel = options ? items.find(r => r.id === options.id) ?? options : null;

  return (
    <View style={styles.root} onLayout={e => setPage(e.nativeEvent.layout.height)}>
      {page === 0 ? null : list.loading ? (
        <ActivityIndicator color={WHITE} style={styles.center} />
      ) : list.error && !items.length ? (
        <View style={[styles.center, styles.state]}>
          <WifiOff size={34} color={WHITE} />
          <Text style={styles.stateTitle}>Couldn't load reels</Text>
          <Text style={styles.stateText}>{list.error.message}</Text>
          <Button title="Try again" variant="secondary" onPress={list.retry} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={r => r.id}
          pagingEnabled
          snapToInterval={page}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: page, offset: page * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onEndReached={list.loadMore}
          onEndReachedThreshold={2}
          onRefresh={refresh}
          refreshing={list.refreshing}
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.y / page);
            const reel = items[i];
            if (reel) setActiveId(reel.id);
          }}
          ListEmptyComponent={
            <View style={[styles.state, { height: page, paddingBottom: bottomInset }]}>
              <Clapperboard size={34} color={WHITE} />
              <Text style={styles.stateTitle}>No reels yet</Text>
              <Text style={styles.stateText}>
                Reels from people you follow and around Nexity show up here.
              </Text>
              <Button title="Create a reel" onPress={() => navigation.navigate('CreateReel')} />
            </View>
          }
          renderItem={({ item }) => (
            <ReelItem
              reel={item}
              height={page}
              bottomInset={bottomInset}
              active={focused && item.id === activeId && !comments && !options && !report}
              muted={muted}
              onToggleMute={toggleMute}
              onComments={openComments}
              onMenu={openMenu}
              onProfile={() =>
                item.author.is_self
                  ? navigation.navigate('Profile')
                  : navigation.navigate('UserProfile', { username: item.author.username })
              }
            />
          )}
        />
      )}

      <CommentsSheet target={comments} onClose={() => setComments(null)} />
      <PostOptionsSheet
        target={
          optionsReel
            ? {
                kind: 'reel',
                id: optionsReel.id,
                caption: optionsReel.caption,
                hide_like_count: optionsReel.hide_like_count,
                comments_disabled: optionsReel.comments_disabled,
              }
            : null
        }
        onClose={() => setOptions(null)}
      />
      {report ? (
        <ReportSheet
          visible
          targetType="reel"
          targetId={report.id}
          blockUserId={report.author.is_self ? undefined : report.author.id}
          username={report.author.username}
          onClose={() => setReport(null)}
          onBlocked={() =>
            setItems(prev => prev.filter(item => item.author.id !== report.author.id))
          }
        />
      ) : null}
    </View>
  );
}

type ItemProps = {
  reel: Reel;
  height: number;
  bottomInset: number;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onComments: (reel: Reel) => void;
  onMenu: (reel: Reel) => void;
  onProfile: () => void;
};

const ReelItem = memo(function ReelPage({
  reel,
  height,
  bottomInset,
  active,
  muted,
  onToggleMute,
  onComments,
  onMenu,
  onProfile,
}: ItemProps) {
  const video = useRef<VideoRef>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [controls, setControls] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burst = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const startSec = (reel.trim_start_ms ?? 0) / 1000;

  // Coming back to a reel starts it playing again.
  useEffect(() => {
    if (!active) {
      setUserPaused(false);
      setControls(false);
    }
  }, [active]);
  useEffect(
    () => () => {
      clearTimeout(tapTimer.current);
      clearTimeout(controlsTimer.current);
    },
    [],
  );

  /** Shows the centre buttons; while playing they fade out after a moment. */
  const showControls = () => {
    clearTimeout(controlsTimer.current);
    setControls(true);
    controlsTimer.current = setTimeout(() => setControls(false), CONTROLS_MS);
  };

  const togglePlay = () => {
    setUserPaused(p => !p);
    showControls();
  };

  const like = (want: boolean) => {
    setLikeState('reel', reel.id, reel, want);
    if (want) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }).start();
    }
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      if (!reel.liked_by_me) like(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(togglePlay, DOUBLE_TAP_MS);
  };

  const playing = active && !userPaused;
  const silent = muted || !!reel.audio_muted;

  return (
    <View style={[styles.page, { height }]}>
      {failed ? (
        <View style={[styles.center, styles.state]}>
          <WifiOff size={30} color={WHITE} />
          <Text style={styles.stateText}>This video couldn't be played.</Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              setFailed(false);
              setReady(false);
            }}
          />
        </View>
      ) : (
        <Video
          ref={video}
          source={{ uri: reel.video_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          paused={!playing}
          muted={silent || !active}
          repeat={reel.trim_end_ms == null}
          onReadyForDisplay={() => setReady(true)}
          onBuffer={e => setBuffering(e.isBuffering)}
          onLoad={() => {
            if (reel.trim_start_ms) video.current?.seek(startSec);
          }}
          onProgress={e => {
            if (reel.trim_end_ms != null && e.currentTime * 1000 >= reel.trim_end_ms - 40) {
              video.current?.seek(startSec);
            }
          }}
          onEnd={() => video.current?.seek(startSec)}
          onError={() => setFailed(true)}
        />
      )}
      {!ready && reel.cover_url && !failed ? (
        <Image source={{ uri: reel.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause reel' : 'Play reel'}
        accessibilityHint="Double tap quickly to like"
      />

      {(buffering || !ready) && active && !failed ? (
        <ActivityIndicator color={WHITE} style={styles.center} pointerEvents="none" />
      ) : null}

      {active && ready && (!playing || controls) ? (
        <View style={styles.playWrap} pointerEvents="box-none">
          {reel.audio_muted ? null : (
            <Pressable
              onPress={() => {
                onToggleMute();
                showControls();
              }}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
              style={styles.soundBadge}
            >
              {muted ? <VolumeX size={24} color={WHITE} /> : <Volume2 size={24} color={WHITE} />}
            </Pressable>
          )}
          <Pressable
            onPress={togglePlay}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={[styles.playBadge, playing && styles.pauseBadge]}
          >
            {playing ? (
              <Pause size={32} color={WHITE} fill={WHITE} />
            ) : (
              <Play size={34} color={WHITE} fill={WHITE} />
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.playWrap} pointerEvents="none">
        <Animated.View
          style={{
            opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              {
                scale: burst.interpolate({
                  inputRange: [0, 0.2, 0.4, 1],
                  outputRange: [0.3, 1.25, 1, 1.05],
                }),
              },
            ],
          }}
        >
          <Heart size={110} color={WHITE} fill={WHITE} />
        </Animated.View>
      </View>

      <View style={[styles.side, { bottom: bottomInset + 20 }]}>
        <Pressable
          onPress={() => like(!reel.liked_by_me)}
          accessibilityRole="button"
          accessibilityLabel={reel.liked_by_me ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: reel.liked_by_me }}
          style={styles.action}
        >
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Heart
              size={30}
              color={reel.liked_by_me ? LIKE : WHITE}
              fill={reel.liked_by_me ? LIKE : 'transparent'}
            />
          </Animated.View>
          {reel.likes_count !== null ? (
            <Text style={styles.count}>{formatCount(reel.likes_count)}</Text>
          ) : null}
        </Pressable>
        {reel.comments_disabled ? null : (
          <Pressable
            onPress={() => onComments(reel)}
            accessibilityRole="button"
            accessibilityLabel="Comments"
            style={styles.action}
          >
            <MessageCircle size={29} color={WHITE} />
            <Text style={styles.count}>{formatCount(reel.comments_count)}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() =>
            Share.share({ message: `https://nexity.com/reels/${reel.id}` }).catch(() => {})
          }
          accessibilityRole="button"
          accessibilityLabel="Share"
          style={styles.action}
        >
          <Send size={27} color={WHITE} />
        </Pressable>
        <Pressable
          onPress={() => onMenu(reel)}
          accessibilityRole="button"
          accessibilityLabel="Reel options"
          style={styles.action}
        >
          <MoreVertical size={26} color={WHITE} />
        </Pressable>
      </View>

      <View style={[styles.info, { bottom: bottomInset + 20 }]} pointerEvents="box-none">
        <Pressable
          onPress={onProfile}
          style={styles.author}
          accessibilityRole="button"
          accessibilityLabel={`${reel.author.username}'s profile`}
        >
          <Avatar uri={reel.author.avatar_url} name={reel.author.display_name} size={34} />
          <Text style={styles.user} numberOfLines={1}>
            {reel.author.username}
          </Text>
        </Pressable>
        {reel.caption ? (
          <Pressable onPress={() => setExpanded(e => !e)} accessibilityRole="button">
            <CaptionText
              caption={reel.caption}
              color={WHITE}
              numberOfLines={expanded ? undefined : 2}
            />
          </Pressable>
        ) : null}
        {reel.location_name ? (
          <View style={styles.loc}>
            <MapPin size={14} color={WHITE} />
            <Text style={styles.locText} numberOfLines={1}>
              {reel.location_name}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  page: { backgroundColor: '#000000' },
  center: { position: 'absolute', alignSelf: 'center', top: '46%' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  stateTitle: { color: WHITE, fontSize: 18, fontWeight: '800' },
  stateText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pauseBadge: { paddingLeft: 0 },
  soundBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  side: { position: 'absolute', right: 8, alignItems: 'center', gap: 6 },
  action: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  count: {
    color: WHITE,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  info: { position: 'absolute', left: 12, right: 76, gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  user: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { color: WHITE, fontSize: 13 },
});
