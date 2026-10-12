import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const WIDTH = 66;
const HEIGHT = 34;
const THUMB = 26;
const PAD = 4;

/**
 * Switch whose state can be read at a glance: a filled track with "ON" when
 * it is on, an outlined track with "OFF" when it is off.
 */
export function Toggle({ value, onChange, accessibilityLabel, disabled }: Props) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, value]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, WIDTH - THUMB - PAD * 2],
  });

  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      accessibilityValue={{ text: value ? 'On' : 'Off' }}
      style={[
        styles.track,
        value
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surfaceAlt, borderColor: colors.textSecondary },
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          value
            ? { color: colors.onButton, left: 10 }
            : { color: colors.textSecondary, right: 9 },
        ]}
      >
        {value ? 'ON' : 'OFF'}
      </Text>
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: value ? colors.onButton : colors.textSecondary,
            transform: [{ translateX }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    left: PAD - 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  label: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  disabled: { opacity: 0.5 },
});
