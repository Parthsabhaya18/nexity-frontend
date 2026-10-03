import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, useAppTheme } from '@/theme';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Emoji shown in a tinted circle above the title. */
  icon?: string;
  top?: ReactNode;
};

export function AuthHeader({ title, subtitle, icon, top }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {top}
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      ) : null}
      <Text
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: { fontSize: 28 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 15, marginTop: 6, lineHeight: 21 },
});
