import { type LucideIcon, Plus } from 'lucide-react-native';
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/features/chats/chatStore';
import { useAppTheme } from '@/theme';
import { clockTime, dayLabel } from '@/utils/time';

import { BubbleBody, type BubbleRect } from './MessageBubble';
import { layoutOverlay, OVERLAY_MARGIN } from './overlayLayout';

export type OverlayAction = {
  key: string;
  label: string;
  Icon: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
};

export type OverlayTarget = {
  message: ChatMessage;
  mine: boolean;
  tail: boolean;
  /** Window coordinates of the bubble when it was long-pressed. */
  rect: BubbleRect;
};

type Props = {
  target: OverlayTarget;
  quickReactions: readonly string[];
  /** My current reaction on the message, highlighted in the bar. */
  current: string | null;
  actions: OverlayAction[];
  onReact: (emoji: string) => void;
  onOpenPicker: () => void;
  /** Called once the exit animation has finished. */
  onClose: () => void;
};

const BAR_HEIGHT = 52;
const BAR_PADDING = 6;
const BAR_ITEM_MAX = 42;
const MENU_WIDTH = 236;
const MENU_HEADER = 34;
const MENU_ITEM = 46;

/**
 * Long-press menu, Instagram-style: the chat dims, the message stays sharp, a quick
 * reaction bar floats above it and the actions below. Drawn inside the screen (not a
 * Modal) so its coordinates match the measured bubble on every platform.
 */
export function MessageActionsOverlay({
  target,
  quickReactions,
  current,
  actions,
  onReact,
  onOpenPicker,
  onClose,
}: Props) {
  const { colors } = useAppTheme();
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<BubbleRect | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const { message, mine, tail, rect } = target;
  const slots = quickReactions.length + 1;
  const item = Math.min(
    BAR_ITEM_MAX,
    Math.floor((screen.width - OVERLAY_MARGIN * 2 - BAR_PADDING * 2) / slots),
  );
  const bar = { width: item * slots + BAR_PADDING * 2, height: BAR_HEIGHT };
  const menu = {
    width: Math.min(MENU_WIDTH, screen.width - OVERLAY_MARGIN * 2),
    height: MENU_HEADER + actions.length * MENU_ITEM + 8,
  };
  const start = origin
    ? { ...rect, x: rect.x - origin.x, y: rect.y - origin.y }
    : rect;
  const layout = layoutOverlay({
    bubble: start,
    screen: origin ?? screen,
    insets,
    bar,
    menu,
    mine,
  });

  useEffect(() => {
    if (!origin) return;
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 320,
      damping: 26,
      mass: 0.8,
    }).start();
  }, [origin, progress]);

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(progress, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }).start(() => {
        onClose();
        after?.();
      });
    },
    [onClose, progress],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const react = (emoji: string) => close(() => onReact(emoji));

  const enter = (from: number) => ({
    opacity: progress,
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [from, 0],
        }),
      },
    ],
  });

  const time = Date.parse(message.created_at);

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      onLayout={() =>
        rootRef.current?.measureInWindow((x, y, width, height) =>
          setOrigin({ x, y, width, height }),
        )
      }
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.overlay, opacity: progress },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      {origin ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.clone,
              {
                left: start.x,
                top: start.y,
                width: start.width,
                height: layout.bubbleHeight,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, layout.bubbleTop - start.y],
                    }),
                  },
                ],
              },
            ]}
          >
            <BubbleBody message={message} mine={mine} tail={tail} />
          </Animated.View>

          <Animated.View
            style={[
              styles.bar,
              {
                left: layout.barLeft,
                top: layout.barTop,
                width: bar.width,
                backgroundColor: colors.surfaceElevated,
              },
              enter(10),
            ]}
          >
            {quickReactions.map((emoji, i) => (
              <Pressable
                key={`${emoji}:${i}`}
                onPress={() => react(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
                style={({ pressed }) => [
                  styles.barItem,
                  { width: item, height: item },
                  current === emoji && { backgroundColor: colors.surfaceAlt },
                  pressed && styles.barPressed,
                ]}
              >
                <Text style={styles.barEmoji} allowFontScaling={false}>
                  {emoji}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                onOpenPicker();
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel="More reactions"
              style={({ pressed }) => [
                styles.barItem,
                { width: item, height: item },
                pressed && styles.barPressed,
              ]}
            >
              <View
                style={[styles.plus, { backgroundColor: colors.surfaceAlt }]}
              >
                <Plus size={20} color={colors.text} />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.menu,
              {
                left: layout.menuLeft,
                top: layout.menuTop,
                width: menu.width,
                backgroundColor: colors.surfaceElevated,
              },
              enter(-10),
            ]}
          >
            <Text
              style={[styles.menuTime, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {`${dayLabel(time)} ${clockTime(time)}`}
            </Text>
            {actions.map(({ key, label, Icon, destructive, onPress }) => {
              const color = destructive ? colors.danger : colors.text;
              return (
                <Pressable
                  key={key}
                  onPress={() => close(onPress)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.menuLabel, { color }]}>{label}</Text>
                  <Icon size={20} color={color} />
                </Pressable>
              );
            })}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 12,
};

const styles = StyleSheet.create({
  clone: { position: 'absolute', overflow: 'hidden', borderRadius: 20 },
  bar: {
    position: 'absolute',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    ...shadow,
  },
  barItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BAR_ITEM_MAX / 2,
  },
  barPressed: { transform: [{ scale: 1.25 }] },
  barEmoji: { fontSize: 26, lineHeight: 32 },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    borderRadius: 16,
    paddingBottom: 8,
    overflow: 'hidden',
    ...shadow,
  },
  menuTime: {
    height: MENU_HEADER,
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  menuItem: {
    height: MENU_ITEM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  menuLabel: { fontSize: 15, fontWeight: '600' },
});
