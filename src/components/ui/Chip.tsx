import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, useAppTheme } from '@/theme';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
};

export function Chip({ label, active, onPress, count = 0 }: Props) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count > 0 ? `${label}, ${count} unread` : label}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: colors.text, borderColor: colors.text }
          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: active ? colors.background : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View style={[styles.count, { backgroundColor: colors.accent }]}>
          <Text style={styles.countText} allowFontScaling={false}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 13.5, fontWeight: '600' },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
