import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

const VISIBLE_MS = 2600;

/** Transient message pill. Render `toast` near the bottom of the screen and call `show`. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          ({ finished }) => finished && setMessage(null),
        );
      }, VISIBLE_MS);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toast = message ? <ToastView message={message} opacity={opacity} /> : null;
  return { toast, show };
}

function ToastView({ message, opacity }: { message: string; opacity: Animated.Value }) {
  const { colors } = useAppTheme();
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { backgroundColor: colors.text, color: colors.background }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, bottom: 96, alignItems: 'center' },
  text: {
    fontSize: 13.5,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
