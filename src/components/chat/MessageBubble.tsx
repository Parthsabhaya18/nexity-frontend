import { CircleAlert, Clock, Reply } from 'lucide-react-native';
import { type ComponentRef, memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { ChatMessage } from '@/features/chats/chatStore';
import type { ReactionGroup, ReplyPreview } from '@/services/api/chat';
import { useAppTheme } from '@/theme';
import { clockTime } from '@/utils/time';

export const MESSAGE_AVATAR_SIZE = 28;
/** Side padding of the message list; the time column extends over it. */
export const CHAT_LIST_PADDING_X = 12;
const GIF_MAX_WIDTH = 220;
const GIF_MAX_HEIGHT = 260;
const STICKER_MAX = 150;
/** Horizontal movement before a drag counts as a swipe (and stops being a scroll). */
export const SWIPE_ACTIVATION_DISTANCE = 8;
/** How far a bubble must travel to trigger a reply. */
export const REPLY_THRESHOLD = 60;
/** How far the whole list slides left (swipe on empty space) to show every message's time. */
export const TIME_REVEAL_DISTANCE = 72;
/** The bubble never travels further than this; it slows down as it gets close. */
export const MAX_SWIPE_DISTANCE = 80;
/** Up to here the bubble follows the finger 1:1, then resistance kicks in. */
const FREE_DRAG = MAX_SWIPE_DISTANCE * 0.6;
export const QUOTE_MAX_LINES = 3;
export const UNAVAILABLE_QUOTE = 'This message is no longer available';
const HIGHLIGHT_MS = 700;

export type BubbleRect = { x: number; y: number; width: number; height: number };
/** Where the bubble is on screen right now (window coordinates). */
export type MeasureBubble = () => Promise<BubbleRect>;

type Props = {
  message: ChatMessage;
  mine: boolean;
  /** Last message of a run from the same sender: shows the avatar and the bubble tail. */
  tail: boolean;
  meId: string | null;
  peer: { display_name: string; avatar_url: string | null } | null;
  /** Shared by all rows, driven by `useTimeReveal` on the list. */
  reveal: Animated.Value;
  /** Changes to a new non-zero value to play the "found it" heartbeat. */
  highlight?: number;
  onRetry: (clientMessageId: string) => void;
  onLongPress: (message: ChatMessage, measure: MeasureBubble) => void;
  onReply: (message: ChatMessage) => void;
  onJumpTo?: (messageId: string) => void;
  onPressReactions?: (message: ChatMessage) => void;
  onPressAvatar?: () => void;
};

/** Short text for quotes, inbox previews and the reply bar. */
export function messageSnippet(
  m: Pick<ChatMessage, 'type' | 'body' | 'is_deleted'>,
) {
  if (m.is_deleted) return 'Message unsent';
  if (m.type === 'gif') return 'GIF';
  if (m.type === 'sticker') return 'Sticker';
  if (m.type === 'image') return 'Photo';
  if (m.type === 'voice') return 'Voice message';
  return m.body;
}

/** Up to three emojis, most popular first, plus the total when more than one person reacted. */
export function reactionSummary(groups: readonly ReactionGroup[] | undefined) {
  const list = [...(groups ?? [])].filter(g => g.count > 0);
  const total = list.reduce((n, g) => n + g.count, 0);
  const emojis = list
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.count - a.g.count || a.i - b.i)
    .slice(0, 3)
    .map(({ g }) => g.emoji);
  return { emojis, total };
}

function gifSize(width: number | null, height: number | null) {
  const w = width || 200;
  const h = height || 200;
  const scale = Math.min(GIF_MAX_WIDTH / w, GIF_MAX_HEIGHT / h, 1.6);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function stickerSize(width: number | null, height: number | null) {
  const w = width || 1;
  const h = height || 1;
  const scale = STICKER_MAX / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Only clearly horizontal drags become swipes, so vertical scrolling keeps working. */
export const isHorizontalSwipe = (dx: number, dy: number) =>
  Math.abs(dx) > SWIPE_ACTIVATION_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5;

/** Finger distance → bubble distance: 1:1 at first, then easing towards MAX_SWIPE_DISTANCE. */
export function swipeDistance(finger: number) {
  const d = Math.max(0, finger);
  if (d <= FREE_DRAG) return d;
  const room = MAX_SWIPE_DISTANCE - FREE_DRAG;
  return FREE_DRAG + room * (1 - Math.exp(-(d - FREE_DRAG) / room));
}

const springBack = (value: Animated.Value) =>
  Animated.spring(value, {
    toValue: 0,
    useNativeDriver: true,
    stiffness: 260,
    damping: 24,
    mass: 0.9,
  }).start();

/**
 * Swipe on empty space in the chat: the whole list slides left and every message
 * shows its time (Instagram-style). Attach `handlers` to a View around the list.
 */
export function useTimeReveal() {
  const reveal = useRef(new Animated.Value(0)).current;
  const responder = useRef(
    PanResponder.create({
      // Bubble phase: a swipe that starts on a message is claimed by that message first.
      onMoveShouldSetPanResponder: (_, g) =>
        isHorizontalSwipe(g.dx, g.dy) && g.dx < 0,
      onPanResponderGrant: () => reveal.stopAnimation(),
      onPanResponderMove: (_, g) =>
        reveal.setValue(-Math.min(TIME_REVEAL_DISTANCE, swipeDistance(-g.dx))),
      onPanResponderRelease: () => springBack(reveal),
      onPanResponderTerminate: () => springBack(reveal),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return { reveal, handlers: responder.panHandlers };
}

type SwipeState = { mine: boolean; canReply: boolean; onReply: () => void };

/**
 * Swipe on a message: that message follows the finger and, past the threshold,
 * becomes the reply target. Received → drag right, mine → drag left (towards the middle).
 * Runs on an Animated.Value, so dragging never re-renders React.
 */
function useReplySwipe(latest: { current: SwipeState }) {
  const drag = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);
  const direction = () => (latest.current.mine ? -1 : 1);

  const settle = () => {
    armed.current = false;
    springBack(drag);
  };

  const responder = useRef(
    PanResponder.create({
      // Capture so the swipe wins over the bubble's long-press Pressable and the list.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        latest.current.canReply &&
        isHorizontalSwipe(g.dx, g.dy) &&
        g.dx * direction() > 0,
      onPanResponderGrant: () => {
        drag.stopAnimation();
        armed.current = false;
      },
      onPanResponderMove: (_, g) => {
        const sign = direction();
        const distance = swipeDistance(g.dx * sign);
        drag.setValue(distance * sign);
        armed.current = distance >= REPLY_THRESHOLD;
      },
      onPanResponderRelease: () => {
        if (armed.current) latest.current.onReply();
        settle();
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return { drag, handlers: responder.panHandlers };
}

/** Double "heartbeat" zoom (1 → 1.06 → 1 → 1.03 → 1), replayed whenever `token` changes. */
function useHeartbeat(token: number | undefined) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!token) return;
    pulse.setValue(0);
    Animated.timing(pulse, {
      toValue: 1,
      duration: HIGHLIGHT_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [token, pulse]);
  return pulse.interpolate({
    inputRange: [0, 0.25, 0.5, 0.7, 1],
    outputRange: [1, 1.06, 1, 1.03, 1],
  });
}

export const MessageBubble = memo(function Bubble({
  message,
  mine,
  tail,
  meId,
  peer,
  reveal,
  highlight,
  onRetry,
  onLongPress,
  onReply,
  onJumpTo,
  onPressReactions,
  onPressAvatar,
}: Props) {
  const { colors } = useAppTheme();
  const failed = message.status === 'failed';
  const deleted = message.is_deleted;
  const canReply = message.status === 'sent' && !deleted;
  const bubbleRef = useRef<ComponentRef<typeof View>>(null);
  const scale = useHeartbeat(highlight);

  const latest = useRef<SwipeState>({
    mine,
    canReply,
    onReply: () => onReply(message),
  });
  latest.current = { mine, canReply, onReply: () => onReply(message) };
  const { drag, handlers } = useReplySwipe(latest);

  const measure: MeasureBubble = () =>
    new Promise(resolve => {
      const node = bubbleRef.current;
      if (!node) return resolve({ x: 0, y: 0, width: 0, height: 0 });
      node.measureInWindow((x, y, width, height) =>
        resolve({ x, y, width, height }),
      );
    });

  // Distance travelled towards the reply direction (positive for both sides).
  const pulled = Animated.multiply(drag, mine ? -1 : 1);
  const replyIconStyle = {
    opacity: pulled.interpolate({
      inputRange: [16, REPLY_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp' as const,
    }),
    transform: [
      {
        scale: pulled.interpolate({
          inputRange: [
            0,
            REPLY_THRESHOLD - 1,
            REPLY_THRESHOLD + 6,
            MAX_SWIPE_DISTANCE,
          ],
          outputRange: [0.4, 0.9, 1.1, 1],
          extrapolate: 'clamp' as const,
        }),
      },
    ],
  };
  const timeOpacity = reveal.interpolate({
    inputRange: [-TIME_REVEAL_DISTANCE * 0.8, -16],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const translateX = Animated.add(drag, reveal);
  const reactions = deleted ? [] : message.reactions ?? [];

  return (
    <View style={[styles.wrap, tail && styles.wrapTail]}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {message.reply_to && !deleted ? (
          <Quote
            reply={message.reply_to}
            mine={mine}
            meId={meId}
            peerName={peer?.display_name ?? ''}
            onJumpTo={onJumpTo}
          />
        ) : null}
        {message.edited_at && !deleted ? (
          <Text
            style={[
              styles.edited,
              mine ? styles.metaOut : styles.metaIn,
              { color: colors.textSecondary },
            ]}
          >
            Edited
          </Text>
        ) : null}
        <View style={[styles.row, mine ? styles.rowOut : styles.rowIn]}>
          {canReply ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.replyIcon,
                mine ? styles.replyIconOut : styles.replyIconIn,
                replyIconStyle,
              ]}
            >
              <View
                style={[
                  styles.replyCircle,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Reply size={16} color={colors.text} />
              </View>
            </Animated.View>
          ) : null}
          {!mine ? (
            tail ? (
              <Pressable
                onPress={onPressAvatar}
                disabled={!onPressAvatar}
                accessibilityRole="button"
                accessibilityLabel={`Open ${
                  peer?.display_name ?? ''
                }'s profile`}
              >
                <Avatar
                  uri={peer?.avatar_url}
                  name={peer?.display_name ?? ''}
                  size={MESSAGE_AVATAR_SIZE}
                />
              </Pressable>
            ) : (
              <View style={styles.avatarSpace} />
            )
          ) : null}
          {mine && message.status === 'sending' ? (
            <Clock
              size={13}
              color={colors.textSecondary}
              accessibilityLabel="Sending"
            />
          ) : null}
          {mine && failed ? (
            <CircleAlert
              size={16}
              color={colors.danger}
              accessibilityLabel="Not delivered"
            />
          ) : null}
          <View style={styles.press} {...handlers}>
            <Pressable
              onLongPress={() => onLongPress(message, measure)}
              delayLongPress={300}
              disabled={deleted}
              accessibilityHint={
                deleted ? undefined : 'Long press for options, swipe to reply'
              }
              style={({ pressed }) => pressed && !deleted && styles.pressed}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <View ref={bubbleRef} collapsable={false}>
                  <BubbleBody message={message} mine={mine} tail={tail} />
                </View>
              </Animated.View>
            </Pressable>
          </View>
          {/*
           * One column just past the right edge of the screen for every message (Instagram):
           * the list slides left by its width, and the time sits in its middle, vertically
           * centred on the bubble however many lines the message has.
           */}
          <Animated.View
            pointerEvents="none"
            style={[styles.time, { opacity: timeOpacity }]}
          >
            <Text
              style={[styles.timeText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {clockTime(Date.parse(message.created_at))}
            </Text>
          </Animated.View>
        </View>
        {reactions.length ? (
          <ReactionBadge
            reactions={reactions}
            mine={mine}
            onPress={
              onPressReactions ? () => onPressReactions(message) : undefined
            }
          />
        ) : null}
        {failed ? (
          <Pressable
            onPress={() => onRetry(message.client_message_id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Not delivered. Tap to retry"
            style={styles.retry}
          >
            <Text style={[styles.retryText, { color: colors.danger }]}>
              Not delivered · Tap to retry
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
});

/** The bubble itself (text, photo, GIF or sticker). Also drawn above the dim layer of the long-press menu. */
export function BubbleBody({
  message,
  mine,
  tail,
}: {
  message: ChatMessage;
  mine: boolean;
  tail: boolean;
}) {
  const { colors } = useAppTheme();
  const failed = message.status === 'failed';
  const deleted = message.is_deleted;
  const media = !deleted && message.media ? message.media : null;
  const shape = mine ? styles.outTail : tail ? styles.inTail : styles.inRun;

  if (!deleted && message.type === 'gif' && media) {
    return (
      <Image
        source={{ uri: media.url }}
        style={[
          styles.gif,
          gifSize(media.width, media.height),
          { backgroundColor: colors.surfaceAlt },
          failed && styles.failed,
        ]}
        resizeMode="cover"
        accessibilityLabel="GIF"
      />
    );
  }
  if (!deleted && message.type === 'sticker' && media) {
    return (
      <Image
        source={{ uri: media.url }}
        style={[stickerSize(media.width, media.height), failed && styles.failed]}
        resizeMode="contain"
        accessibilityLabel="Sticker"
      />
    );
  }
  if (deleted) {
    return (
      <View
        style={[
          styles.bubble,
          styles.deletedBubble,
          { borderColor: colors.border },
        ]}
      >
        <Text
          style={[styles.text, styles.deleted, { color: colors.textSecondary }]}
        >
          {mine ? 'You unsent a message' : 'Message unsent'}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.bubble,
        shape,
        media && styles.imageBubble,
        {
          backgroundColor: mine ? colors.bubbleOutgoing : colors.bubbleIncoming,
        },
        failed && styles.failed,
      ]}
    >
      {media ? (
        <Image
          source={{ uri: media.url }}
          style={[
            styles.image,
            media.width && media.height
              ? { aspectRatio: media.width / media.height }
              : null,
          ]}
          resizeMode="cover"
          accessibilityLabel="Photo"
        />
      ) : null}
      {message.body ? (
        <Text
          style={[
            styles.text,
            media && styles.imageCaption,
            { color: mine ? colors.onButton : colors.text },
          ]}
        >
          {message.body}
        </Text>
      ) : null}
    </View>
  );
}

/** Rounded pill under the bubble ("❤️😂 3"); pops when the reactions change. */
function ReactionBadge({
  reactions,
  mine,
  onPress,
}: {
  reactions: readonly ReactionGroup[];
  mine: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const { emojis, total } = reactionSummary(reactions);
  const signature = reactions.map(g => `${g.emoji}${g.count}`).join(',');
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(0.4);
    Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 380,
      damping: 14,
      mass: 0.7,
    }).start();
  }, [signature, pop]);

  if (!emojis.length) return null;
  return (
    <Animated.View
      style={[
        styles.badgeWrap,
        mine ? styles.badgeOut : styles.badgeIn,
        { transform: [{ scale: pop }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Reactions: ${emojis.join(' ')}${
          total > 1 ? `, ${total} people` : ''
        }. Tap to see who reacted`}
        style={({ pressed }) => [
          styles.badge,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.background,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.badgeEmoji} allowFontScaling={false}>
          {emojis.join('')}
        </Text>
        {total > 1 ? (
          <Text style={[styles.badgeCount, { color: colors.textSecondary }]}>
            {total}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Real measurements by "screen width:text", reused when rows are recycled or reopened. */
const quoteTruncation = new Map<string, boolean>();
/** Average glyph width for the 14px quote font, slightly generous so long text isn't missed. */
const QUOTE_CHAR_WIDTH = 7.4;

/** Widest the quote text can be: 75% of the list, minus the side bar and the padding. */
export function quoteTextWidth(screenWidth: number) {
  const list = screenWidth - CHAT_LIST_PADDING_X * 2;
  const quote = list * 0.75 - (MESSAGE_AVATAR_SIZE + 8);
  return Math.max(80, quote - 9 - QUOTE_PADDING_X * 2);
}

/** Rough line count: each paragraph wraps at the available width. */
export function estimateQuoteLines(text: string, width: number) {
  const perLine = Math.max(8, Math.floor(width / QUOTE_CHAR_WIDTH));
  return text
    .split('\n')
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
}

/**
 * Quoted message above a reply: label, faded bubble and a side bar, like Instagram.
 * At most three lines; "See more" (or tapping the quote) jumps to the original.
 */
function Quote({
  reply,
  mine,
  meId,
  peerName,
  onJumpTo,
}: {
  reply: ReplyPreview;
  mine: boolean;
  meId: string | null;
  peerName: string;
  onJumpTo?: (messageId: string) => void;
}) {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const quotedMe = reply.sender_id === meId;
  const unavailable = reply.is_deleted;
  const text = unavailable ? UNAVAILABLE_QUOTE : messageSnippet(reply);
  const measureKey = `${Math.round(screenWidth)}:${text}`;
  // First paint uses the remembered measurement or an estimate, so "See more" doesn't pop in later.
  const [truncated, setTruncated] = useState(
    () =>
      quoteTruncation.get(measureKey) ??
      estimateQuoteLines(text, quoteTextWidth(screenWidth)) > QUOTE_MAX_LINES,
  );
  const label = mine
    ? quotedMe
      ? 'You replied to yourself'
      : `You replied to ${peerName}`
    : quotedMe
    ? `${peerName} replied to you`
    : `${peerName} replied to themselves`;
  const bar = (
    <View style={[styles.quoteBar, { backgroundColor: colors.border }]} />
  );
  const canJump = Boolean(onJumpTo) && !unavailable;

  return (
    <View style={[styles.quoteWrap, mine ? styles.quoteOut : styles.quoteIn]}>
      <Text
        style={[styles.quoteLabel, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.quoteRow}>
        {mine ? null : bar}
        <Pressable
          onPress={() => onJumpTo?.(reply.id)}
          disabled={!canJump}
          accessibilityRole={canJump ? 'button' : undefined}
          accessibilityHint={canJump ? 'Shows the original message' : undefined}
          style={({ pressed }) => [
            styles.quote,
            { backgroundColor: colors.surfaceAlt },
            pressed && styles.quotePressed,
          ]}
        >
          <Text
            style={[
              styles.quoteText,
              { color: colors.textSecondary },
              unavailable && styles.deleted,
            ]}
            numberOfLines={QUOTE_MAX_LINES}
          >
            {text}
          </Text>
          {truncated && canJump ? (
            <Text style={[styles.seeMore, { color: colors.text }]}>
              See more
            </Text>
          ) : null}
          {/* Same text without a line limit, only to learn whether the visible one was cut. */}
          {!unavailable ? (
            <Text
              style={[styles.quoteText, styles.measure]}
              onTextLayout={e => {
                const cut = e.nativeEvent.lines.length > QUOTE_MAX_LINES;
                quoteTruncation.set(measureKey, cut);
                setTruncated(cut);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {text}
            </Text>
          ) : null}
        </Pressable>
        {mine ? bar : null}
      </View>
    </View>
  );
}

const BUBBLE_RADIUS = 20;
const TAIL_RADIUS = 6;
const QUOTE_PADDING_X = 14;

const styles = StyleSheet.create({
  wrap: { marginBottom: 3 },
  wrapTail: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowIn: { justifyContent: 'flex-start' },
  rowOut: { justifyContent: 'flex-end' },
  avatarSpace: { width: MESSAGE_AVATAR_SIZE },
  press: { maxWidth: '78%' },
  pressed: { opacity: 0.85 },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BUBBLE_RADIUS,
    overflow: 'hidden',
  },
  outTail: { borderBottomRightRadius: TAIL_RADIUS },
  inTail: { borderBottomLeftRadius: TAIL_RADIUS },
  inRun: { borderTopLeftRadius: TAIL_RADIUS },
  imageBubble: { padding: 4 },
  image: {
    width: 240,
    maxHeight: 300,
    aspectRatio: 4 / 5,
    borderRadius: 16,
  },
  gif: { borderRadius: 16 },
  imageCaption: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  text: { fontSize: 15, lineHeight: 21 },
  deletedBubble: { borderWidth: 1, backgroundColor: 'transparent' },
  deleted: { fontStyle: 'italic' },
  failed: { opacity: 0.75 },
  retry: { alignSelf: 'flex-end', marginTop: 4, marginRight: 4 },
  retryText: { fontSize: 12, fontWeight: '700' },
  edited: { fontSize: 11.5, fontWeight: '600', marginBottom: 3 },
  metaOut: { alignSelf: 'flex-end', marginRight: 6 },
  metaIn: { alignSelf: 'flex-start', marginLeft: MESSAGE_AVATAR_SIZE + 14 },
  replyIcon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  replyIconIn: { right: '100%', marginRight: 14 },
  replyIconOut: { left: '100%', marginLeft: 14 },
  replyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '100%',
    // Reaches the screen edge (past the list padding), so the time is centred in the gap.
    width: TIME_REVEAL_DISTANCE + CHAT_LIST_PADDING_X,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { fontSize: 11.5, fontWeight: '600' },
  badgeWrap: { marginTop: -6, zIndex: 1 },
  badgeOut: { alignSelf: 'flex-end', marginRight: 10 },
  badgeIn: { alignSelf: 'flex-start', marginLeft: MESSAGE_AVATAR_SIZE + 18 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 14,
    borderWidth: 2,
  },
  badgeEmoji: { fontSize: 14, lineHeight: 19 },
  badgeCount: { fontSize: 12, fontWeight: '700' },
  quoteWrap: { maxWidth: '75%', marginTop: 6, marginBottom: 4 },
  quoteOut: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  quoteIn: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginLeft: MESSAGE_AVATAR_SIZE + 8,
  },
  quoteLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
    marginHorizontal: 2,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    maxWidth: '100%',
  },
  quoteBar: { width: 3, borderRadius: 2 },
  quote: {
    flexShrink: 1,
    paddingHorizontal: QUOTE_PADDING_X,
    paddingVertical: 9,
    borderRadius: 18,
    opacity: 0.85,
  },
  quotePressed: { opacity: 0.6 },
  quoteText: { fontSize: 14, lineHeight: 19 },
  seeMore: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  measure: {
    position: 'absolute',
    left: QUOTE_PADDING_X,
    right: QUOTE_PADDING_X,
    top: 0,
    opacity: 0,
  },
});
