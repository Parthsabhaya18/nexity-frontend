import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

type Props = { tone: 'error' | 'success' | 'info'; message: string };

export function Banner({ tone, message }: Props) {
  const { colors } = useAppTheme();
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.danger, icon: '!' },
    success: { bg: colors.successSoft, fg: colors.success, icon: '✓' },
    info: { bg: colors.primarySoft, fg: colors.text, icon: 'i' },
  }[tone];

  return (
    <View
      style={[styles.box, { backgroundColor: palette.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.icon, { borderColor: palette.fg }]}>
        <Text style={[styles.iconText, { color: palette.fg }]}>
          {palette.icon}
        </Text>
      </View>
      <Text style={[styles.text, { color: palette.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  iconText: { fontSize: 12, fontWeight: '800' },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
