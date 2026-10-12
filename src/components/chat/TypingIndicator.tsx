import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { useAppTheme } from '@/theme';

import { MESSAGE_AVATAR_SIZE } from './MessageBubble';

const DOTS = 3;
const STAGGER_MS = 150;
const CYCLE_MS = 1100;

/** Incoming "…" bubble shown while the other person is typing. */
export function TypingIndicator({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const { colors } = useAppTheme();
  const progress = useRef(
    Array.from({ length: DOTS }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const loops = progress.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.timing(value, {
            toValue: 1,
            duration: CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [progress]);

  return (
    <View
      style={styles.row}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${name} is typing`}
    >
      <Avatar uri={avatarUrl} name={name} size={MESSAGE_AVATAR_SIZE} />
      <View style={[styles.bubble, { backgroundColor: colors.bubbleIncoming }]}>
        {progress.map((value, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: colors.textSecondary },
              {
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
                }),
                transform: [
                  {
                    translateY: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -3],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  bubble: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
