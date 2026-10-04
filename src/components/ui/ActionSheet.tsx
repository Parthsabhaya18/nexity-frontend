import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useAppTheme } from '@/theme';

export type ActionSheetOption = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
};

const DISMISS_MS = 350;

/** Bottom sheet of actions; Android back and tapping outside close it. */
export function ActionSheet({ visible, title, options, onClose }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {title ? (
          <Text style={[styles.title, { color: colors.textSecondary }]}>
            {title}
          </Text>
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
            Cancel
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
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
