import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { darkScreen, spacing, useAppTheme } from '@/theme';

type Props = {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
  /** Text colours for dark screens such as Reels. */
  tone?: 'default' | 'dark';
};

export function EmptyState({
  icon,
  title,
  text,
  action,
  tone = 'default',
}: Props) {
  const { colors } = useAppTheme();
  const dark = tone === 'dark';
  const artColor = dark ? 'rgba(255, 255, 255, 0.12)' : colors.primarySoft;
  const titleColor = dark ? darkScreen.text : colors.text;
  const textColor = dark ? darkScreen.textSecondary : colors.textSecondary;

  return (
    <View style={styles.wrap}>
      <View style={[styles.art, { backgroundColor: artColor }]}>{icon}</View>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {text ? (
        <Text style={[styles.text, { color: textColor }]}>{text}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 44,
  },
  art: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  text: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  action: { marginTop: 18, alignSelf: 'stretch', alignItems: 'center' },
});
