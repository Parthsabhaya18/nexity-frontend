import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { darkScreen, spacing, useAppTheme } from '@/theme';

import { Button } from './Button';

type Props = {
  icon: ReactNode;
  title: string;
  /** Subtitle under the title. */
  text?: string;
  /** Shorthand for a primary button; `action` wins when both are set. */
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  /** Text colours for dark screens such as Reels. */
  tone?: 'default' | 'dark';
};

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
  action,
  tone = 'default',
}: Props) {
  const { colors } = useAppTheme();
  const dark = tone === 'dark';
  const artColor = dark ? darkScreen.iconTile : colors.primarySoft;
  const titleColor = dark ? darkScreen.text : colors.text;
  const textColor = dark ? darkScreen.textSecondary : colors.textSecondary;
  const button =
    action ??
    (actionLabel && onAction ? (
      <Button title={actionLabel} onPress={onAction} style={styles.button} />
    ) : null);

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.art, { backgroundColor: artColor }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {icon}
      </View>
      <Text
        style={[styles.title, { color: titleColor }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {text ? (
        <Text style={[styles.text, { color: textColor }]}>{text}</Text>
      ) : null}
      {button ? <View style={styles.action}>{button}</View> : null}
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
  button: { minWidth: 180 },
});
