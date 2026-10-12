import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, useAppTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';

export type ActionSheetOption = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  /** One line under the title, e.g. what the actions apply to. */
  message?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  cancelLabel?: string;
};

const DISMISS_MS = 350;

/** Bottom sheet of actions; Android back and tapping outside close it. */
export function ActionSheet({
  visible,
  title,
  message,
  options,
  onClose,
  cancelLabel = 'Cancel',
}: Props) {
  const { colors } = useAppTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {title || message ? (
        <View style={styles.header}>
          {title ? (
            <Text
              style={[styles.title, { color: colors.textSecondary }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
        </View>
      ) : null}
      {options.map(option => {
        const color = option.destructive ? colors.danger : colors.text;
        return (
          <Pressable
            key={option.label}
            onPress={() => {
              onClose();
              // iOS can't present a picker while this modal is still dismissing.
              setTimeout(option.onPress, DISMISS_MS);
            }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            {option.icon}
            <Text style={[styles.label, { color }]}>{option.label}</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        style={({ pressed }) => [
          styles.row,
          styles.cancel,
          { borderTopColor: colors.border },
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <Text
          style={[styles.label, styles.cancelLabel, { color: colors.text }]}
        >
          {cancelLabel}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: { fontSize: 13, textAlign: 'center' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.lg,
  },
  label: { fontSize: 16, fontWeight: '600' },
  cancel: {
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
  cancelLabel: { fontWeight: '700' },
});
