import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';

export type SheetAction = {
  key: string;
  label: string;
  Icon: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
  /** Optional context above the actions (e.g. the long-pressed message). */
  preview?: ReactNode;
};

/** Long-press menu. Each action closes the sheet before running. */
export function ActionSheet({ visible, onClose, actions, preview }: Props) {
  const { colors } = useAppTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {preview ? <View style={styles.preview}>{preview}</View> : null}
      <View style={styles.list}>
        {actions.map(({ key, label, Icon, destructive, onPress }) => {
          const color = destructive ? colors.danger : colors.text;
          return (
            <Pressable
              key={key}
              onPress={() => {
                onClose();
                onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.item,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Icon size={22} color={color} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { paddingHorizontal: 20, paddingTop: 14 },
  list: { paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  label: { fontSize: 15.5, fontWeight: '600' },
});
