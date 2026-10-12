import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  size?: number;
  /** Unread count shown top-right; hidden when 0. */
  badge?: number;
  style?: ViewStyle;
};

export function IconButton({
  onPress,
  accessibilityLabel,
  children,
  disabled,
  size = 44,
  badge = 0,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const label =
    badge > 0 ? `${accessibilityLabel}, ${badge} unread` : accessibilityLabel;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
      {badge > 0 ? (
        <Text
          style={[
            styles.badge,
            { backgroundColor: colors.accent, borderColor: colors.background },
          ]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {badge > 99 ? '99+' : badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
