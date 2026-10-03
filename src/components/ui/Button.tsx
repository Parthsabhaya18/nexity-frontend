import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { radius, useAppTheme } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  loadingTitle?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  loadingTitle,
  disabled,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: colors.button, fg: colors.onButton, border: colors.button },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        inactive && !loading && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} style={styles.spinner} />
        ) : null}
        <Text style={[styles.text, { color: palette.fg }]}>
          {loading && loadingTitle ? loadingTitle : title}
        </Text>
      </View>
    </Pressable>
  );
}

export function LinkButton({
  title,
  onPress,
  strong,
  disabled,
}: {
  title: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.link,
            { color: disabled ? colors.textSecondary : colors.primary },
            strong && styles.linkStrong,
            pressed && styles.pressed,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 8 },
  text: { fontSize: 15.5, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  link: { fontSize: 14, fontWeight: '600' },
  linkStrong: { fontWeight: '800' },
});
