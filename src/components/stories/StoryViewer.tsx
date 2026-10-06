import { useNavigation } from '@react-navigation/native';
import {
  ChevronUp,
  Eye,
  Heart,
  MoreHorizontal,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { UserRow } from '@/components/follows/UserRow';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { StoryStage } from '@/components/stories/StoryStage';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import type { StoryOverlay } from '@/features/stories/overlay';
import { markOwnStorySeen } from '@/features/stories/storyEvents';
import { ApiError } from '@/services/api/client';
import {
  type StoryGroup,
  type StoryViewerRow,
  storiesApi,
} from '@/services/api/stories';
import { useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

import { DEFAULT_SHARED_LAYOUT, SharedStoryFrame } from './SharedStoryFrame';

const IMAGE_MS = 5000;
const SWIPE_CLOSE = 120;
const SWIPE_UP = 70;
const SWIPE_GROUP = 70;
// Stories are always shown full-screen on black, so the chrome is white.
const WHITE = '#FFFFFF';

/** Video length as m:ss, like the reel badge Instagram shows on a shared reel. */
const clipTime = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Props = {
  groups: StoryGroup[];
  /** Index of the group to open; null keeps the viewer closed. */
  startIndex: number | null;
  onClose: () => void;
  /** A story was deleted; the tray should reload. */
  onChanged?: () => void;
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Please try again.';

/**
 * Full-screen stories: tap right/left to move, hold to pause, swipe sideways
 * for the next person, swipe down to close. Viewers can like a story or send
 * a private reply; owners see who viewed it and can delete it.
 */
export function StoryViewer({ groups, startIndex, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const navigation = useNavigation();
  const [g, setG] = useState(0);
  const [i, setI] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [held, setHeld] = useState(false);
  const [typing, setTyping] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerRow[] | null>(null);
  const [appActive, setAppActive] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [clipLeft, setClipLeft] = useState(0);
  const [text, setText] = useState('');
  const [answerTo, setAnswerTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const videoDuration = useRef(0);

  const open = startIndex !== null;
  const group = open ? groups[g] : undefined;
  const stories = useMemo(
    () => group?.stories.filter(s => !removed.has(s.id)) ?? [],
    [group, removed],
  );
  const item = stories[Math.min(i, Math.max(0, stories.length - 1))];
  const mine = !!group?.user.is_self;
  const paused =
    held || typing || reporting || viewersOpen || !appActive || !loaded || sending;

  useEffect(() => {
    if (startIndex === null) return;
    setG(startIndex);
    const opened = groups[startIndex];
    const first = opened?.user.is_self ? 0 : opened?.stories.findIndex(s => !s.seen) ?? 0;
    setI(Math.max(0, first));
    setRemoved(new Set());
    drag.setValue(0);
    // Only when the viewer opens on a new person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const next = useCallback(() => {
    if (i + 1 < stories.length) {
      setI(i + 1);
    } else if (g + 1 < groups.length) {
      setG(g + 1);
      setI(0);
    } else {
      onClose();
    }
  }, [i, stories.length, g, groups.length, onClose]);

  const prev = useCallback(() => {
    if (i > 0) {
      setI(i - 1);
    } else if (g > 0) {
      setG(g - 1);
      setI(Math.max(0, groups[g - 1]!.stories.length - 1));
    } else {
      progress.setValue(0);
    }
  }, [i, g, groups, progress]);

  const nextGroup = () => {
    if (g + 1 < groups.length) {
      setG(g + 1);
      setI(0);
    } else onClose();
  };
  const prevGroup = () => {
    if (g > 0) {
      setG(g - 1);
      setI(0);
    }
  };

  // New story: reset the bar, stickers and reply box; mark it seen.
  useEffect(() => {
    anim.current?.stop();
    progress.setValue(0);
    setLoaded(false);
    setText('');
    setAnswerTo(null);
    videoDuration.current = 0;
    setClipLeft(0);
    setOverlays(item?.overlays ?? []);
    if (item && !item.seen) storiesApi.view(item.id).catch(() => {});
    if (item && mine) markOwnStorySeen(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Photos run on a 5 s timer that pauses while held or typing.
  useEffect(() => {
    if (!item || item.kind === 'video') return;
    if (paused) {
      anim.current?.stop();
      return;
    }
    let value = 0;
    progress.stopAnimation(v => {
      value = v;
    });
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, (1 - value) * IMAGE_MS),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current = a;
    a.start(({ finished }) => {
      if (finished) next();
    });
    return () => a.stop();
  }, [item, paused, progress, next]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, s) =>
        Math.abs(s.dy) > 12 || Math.abs(s.dx) > 18,
      onPanResponderGrant: () => setHeld(true),
      onPanResponderMove: (_, s) => {
        if (s.dy > 0 && Math.abs(s.dy) > Math.abs(s.dx)) drag.setValue(s.dy);
      },
      onPanResponderRelease: (_, s) => {
        setHeld(false);
        const flick = s.dy > 40 && s.vy > 0.6;
        if ((s.dy > SWIPE_CLOSE || flick) && Math.abs(s.dy) > Math.abs(s.dx)) {
          onCloseRef.current();
          return;
        }
        if (s.dy < -SWIPE_UP && Math.abs(s.dy) > Math.abs(s.dx)) {
          drag.setValue(0);
          swipeUpRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        if (Math.abs(s.dx) > SWIPE_GROUP && Math.abs(s.dx) > Math.abs(s.dy)) {
          if (s.dx < 0) nextGroupRef.current();
          else prevGroupRef.current();
        }
      },
      onPanResponderTerminate: () => {
        setHeld(false);
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const nextGroupRef = useRef(nextGroup);
  nextGroupRef.current = nextGroup;
  const prevGroupRef = useRef(prevGroup);
  prevGroupRef.current = prevGroup;
  const inputRef = useRef<TextInputInstance>(null);
  const swipeUpRef = useRef(() => {});

  // Your own story: load who viewed it, for the count at the bottom.
  useEffect(() => {
    if (!open || !mine || !item) return;
    let live = true;
    setViewers(null);
    storiesApi
      .viewers(item.id)
      .then(list => live && setViewers(list))
      .catch(() => live && setViewers([]));
    return () => {
      live = false;
    };
  }, [open, mine, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !group || !item) return null;

  const isLiked = liked[item.id] ?? !!item.liked_by_me;

  const toggleLike = () => {
    const want = !isLiked;
    setLiked(l => ({ ...l, [item.id]: want }));
    storiesApi.setLiked(item.id, want).catch(err => {
      setLiked(l => ({ ...l, [item.id]: !want }));
      Alert.alert("Couldn't update", errorText(err));
    });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (answerTo) await storiesApi.reply(item.id, answerTo, body);
      else await storiesApi.message(item.id, body);
      setText('');
      setAnswerTo(null);
      setTyping(false);
    } catch (err) {
      Alert.alert("Couldn't send", errorText(err));
    } finally {
      setSending(false);
    }
  };

  const openViewers = () => {
    setViewersOpen(true);
    storiesApi
      .viewers(item.id)
      .then(setViewers)
      .catch(() => setViewers(v => v ?? []));
  };

  // Swipe up: your own story shows its viewers; someone else's opens the reply box.
  swipeUpRef.current = mine ? openViewers : () => inputRef.current?.focus();

  const remove = () => {
    setHeld(true);
    Alert.alert('Delete story?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setHeld(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await storiesApi.remove(item.id);
            onChanged?.();
            if (stories.length <= 1) {
              onClose();
              return;
            }
            setRemoved(r => new Set(r).add(item.id));
            if (i >= stories.length - 1) setI(i - 1);
          } catch (err) {
            Alert.alert("Couldn't delete", errorText(err));
          } finally {
            setHeld(false);
          }
        },
      },
    ]);
  };

  const openProfile = () => {
    onClose();
    if (group.user.is_self) navigation.navigate('Profile');
    else navigation.navigate('UserProfile', { username: group.user.username });
  };

  const sharedPost = item?.shared?.kind === 'post' ? item.shared : null;
  const media =
    item.kind === 'video' ? (
      <Video
        key={item.id}
        source={{ uri: item.url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        paused={paused && loaded}
        onLoad={e => {
          videoDuration.current = e.duration;
          setClipLeft(Math.ceil(e.duration));
          setLoaded(true);
        }}
        onProgress={e => {
          if (videoDuration.current > 0) {
            progress.setValue(Math.min(1, e.currentTime / videoDuration.current));
            setClipLeft(Math.max(0, Math.ceil(videoDuration.current - e.currentTime)));
          }
        }}
        onEnd={next}
        onError={() => setLoaded(true)}
      />
    ) : (
      <Image
        key={item.id}
        source={{ uri: item.url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    );

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={[styles.backdrop, { paddingTop: insets.top }]}>
      <Animated.View
        style={[
          styles.fill,
          styles.card,
          {
            transform: [{ translateY: drag }],
            opacity: drag.interpolate({
              inputRange: [0, height],
              outputRange: [1, 0.3],
              extrapolate: 'clamp',
            }),
          },
        ]}
        {...pan.panHandlers}
      >
        {sharedPost && item.kind === 'image' ? (
          <Image
            source={{ uri: item.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={30}
          />
        ) : null}
        {sharedPost ? <View style={styles.sharedDim} /> : null}
        {item.shared ? (
          <SharedStoryFrame
            shared={item.shared}
            layout={item.shared.layout ?? DEFAULT_SHARED_LAYOUT}
          >
            {media}
          </SharedStoryFrame>
        ) : (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {media}
          </View>
        )}
        {!loaded ? <ActivityIndicator color={WHITE} style={styles.loader} /> : null}

        <View style={styles.taps}>
          <Pressable
            style={styles.tapLeft}
            onPress={prev}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
            delayLongPress={180}
            accessibilityRole="button"
            accessibilityLabel="Previous story"
          />
          <Pressable
            style={styles.tapRight}
            onPress={next}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
            delayLongPress={180}
            accessibilityRole="button"
            accessibilityLabel="Next story"
          />
        </View>

        <StoryStage
          overlays={overlays}
          onVote={(overlayId, option) => {
            storiesApi
              .vote(item.id, overlayId, option)
              .then(nextStory => setOverlays(nextStory.overlays ?? []))
              .catch(err => Alert.alert("Couldn't save that vote", errorText(err)));
          }}
          onReply={id => {
            setAnswerTo(id);
            setTyping(true);
          }}
        />

        <View style={[styles.top, styles.topPad]} pointerEvents="box-none">
          <View style={styles.bars}>
            {stories.map((s, n) => (
              <View key={s.id} style={styles.barTrack}>
                {n < i ? (
                  <View style={[styles.barFill, { width: '100%' }]} />
                ) : n === i ? (
                  <Animated.View
                    style={[
                      styles.barFill,
                      {
                        width: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.meta}>
            <Pressable
              onPress={openProfile}
              style={styles.who}
              accessibilityRole="button"
              accessibilityLabel={`${group.user.username}'s profile`}
            >
              <Avatar uri={group.user.avatar_url} name={group.user.display_name} size={32} />
              <Text style={styles.name} numberOfLines={1}>
                {group.user.username}
              </Text>
              <Text style={styles.time}>
                {timeAgo(new Date(item.created_at).getTime())}
              </Text>
            </Pressable>
            {mine ? null : (
              <Pressable
                onPress={() => setReporting(true)}
                accessibilityRole="button"
                accessibilityLabel="Story options"
                hitSlop={8}
                style={styles.icon}
              >
                <MoreHorizontal color={WHITE} size={24} />
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.icon}
            >
              <X color={WHITE} size={26} />
            </Pressable>
          </View>
          {item.shared?.kind === 'reel' ? (
            <View style={styles.reelBy}>
              <Text style={styles.reelByName} numberOfLines={1}>
                {item.shared.username}
              </Text>
              {loaded && videoDuration.current > 0 ? (
                <Text style={styles.reelByTime}>{clipTime(clipLeft)}</Text>
              ) : null}
            </View>
          ) : null}
          {item.location_name ? (
            <Text style={styles.location} numberOfLines={1}>
              {item.location_name}
            </Text>
          ) : null}
        </View>

        <KeyboardAvoidingView
          behavior="padding"
          style={styles.bottomWrap}
          pointerEvents="box-none"
        >
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
            {mine ? (
              <>
                <Pressable
                  onPress={openViewers}
                  accessibilityRole="button"
                  accessibilityLabel={`${viewers?.length ?? 0} viewers. Swipe up or tap to see who viewed your story`}
                  hitSlop={8}
                  style={styles.activity}
                >
                  <ChevronUp size={18} color={WHITE} style={styles.swipeHint} />
                  <View style={styles.activityRow}>
                    {viewers && viewers.length ? (
                      <View style={styles.faces}>
                        {viewers.slice(0, 3).map((u, n) => (
                          <View
                            key={u.id}
                            style={[styles.face, n > 0 && styles.faceOverlap]}
                          >
                            <Avatar uri={u.avatar_url} name={u.display_name} size={22} />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Eye size={20} color={WHITE} />
                    )}
                    <Text style={styles.ownerText}>
                      {viewers === null ? '' : viewers.length}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.flex} />
                <Pressable
                  onPress={remove}
                  accessibilityRole="button"
                  accessibilityLabel="Delete story"
                  hitSlop={8}
                  style={styles.roundBtn}
                >
                  <Trash2 size={22} color={WHITE} />
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  onFocus={() => setTyping(true)}
                  onBlur={() => {
                    if (!text.trim()) {
                      setTyping(false);
                      setAnswerTo(null);
                    }
                  }}
                  placeholder={answerTo ? 'Type your answer…' : 'Send message'}
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  maxLength={500}
                  autoFocus={!!answerTo}
                  style={styles.input}
                  accessibilityLabel={answerTo ? 'Answer' : 'Reply privately'}
                />
                {text.trim() ? (
                  <Pressable
                    onPress={send}
                    disabled={sending}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                    style={styles.icon}
                  >
                    {sending ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <SendHorizontal size={24} color={WHITE} />
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={toggleLike}
                    accessibilityRole="button"
                    accessibilityLabel={isLiked ? 'Unlike story' : 'Like story'}
                    accessibilityState={{ selected: isLiked }}
                    style={styles.icon}
                  >
                    <Heart
                      size={28}
                      color={isLiked ? '#FF3B5C' : WHITE}
                      fill={isLiked ? '#FF3B5C' : 'transparent'}
                    />
                  </Pressable>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
      </View>

      <BottomSheet visible={viewersOpen} onClose={() => setViewersOpen(false)} style={styles.viewers}>
        <View style={styles.sheetHead}>
          <Eye size={18} color={colors.text} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {viewers ? viewers.length : ''}
          </Text>
        </View>
        {viewers === null ? (
          <UserListSkeleton rows={5} />
        ) : (
          <FlatList
            data={viewers}
            keyExtractor={u => u.id}
            renderItem={({ item: u }) => (
              <UserRow
                user={u}
                onPress={() => {
                  setViewersOpen(false);
                  onClose();
                  navigation.navigate('UserProfile', { username: u.username });
                }}
                trailing={
                  u.liked ? (
                    <Heart
                      size={20}
                      color={colors.like}
                      fill={colors.like}
                      accessibilityLabel="Liked your story"
                    />
                  ) : null
                }
              />
            )}
            ListEmptyComponent={
              <Text style={[styles.sheetEmpty, { color: colors.textSecondary }]}>
                No one has viewed this story yet.
              </Text>
            }
          />
        )}
      </BottomSheet>
      <ReportSheet
        visible={reporting}
        targetType="story"
        targetId={item.id}
        blockUserId={mine ? undefined : group.user.id}
        username={group.user.username}
        onClose={() => setReporting(false)}
        onBlocked={onClose}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
  /** Black strip behind the phone's status bar; the story starts below it. */
  backdrop: { flex: 1, backgroundColor: '#000000' },
  card: { borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  topPad: { paddingTop: 10 },
  loader: { position: 'absolute', alignSelf: 'center', top: '48%' },
  sharedDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  taps: { ...StyleSheet.absoluteFill, top: 110, bottom: 90, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  top: { position: 'absolute', left: 8, right: 8, gap: 8 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: 2.5, backgroundColor: WHITE },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reelBy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
    paddingLeft: 2,
  },
  reelByName: { color: WHITE, fontWeight: '600', fontSize: 13.5, flexShrink: 1 },
  reelByTime: { color: WHITE, fontWeight: '600', fontSize: 13 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: WHITE, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  time: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  location: { color: WHITE, fontSize: 12.5, fontWeight: '600', marginLeft: 40 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 16,
    color: WHITE,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  flex: { flex: 1 },
  activity: { alignItems: 'center', paddingHorizontal: 6 },
  swipeHint: { marginBottom: -2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 32 },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 1.5, borderColor: '#000000', borderRadius: 13 },
  faceOverlap: { marginLeft: -8 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ownerText: { color: WHITE, fontWeight: '700' },
  viewers: { height: '60%' },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  sheetTitle: { fontWeight: '800', fontSize: 16 },
  sheetEmpty: { textAlign: 'center', marginTop: 24 },
});
