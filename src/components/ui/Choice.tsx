import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.field}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map(o => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected
                    ? colors.primarySoft
                    : colors.surface,
                  borderColor: selected
                    ? colors.primary
                    : error
                    ? colors.danger
                    : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.primary : colors.text },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.checkRow}
      >
        <View
          style={[
            styles.box,
            {
              backgroundColor: checked ? colors.button : colors.inputBackground,
              borderColor: checked
                ? colors.button
                : error
                ? colors.danger
                : colors.border,
            },
          ]}
        >
          {checked ? (
            <Text style={[styles.tick, { color: colors.onButton }]}>✓</Text>
          ) : null}
        </View>
        <View style={styles.checkText}>{children}</View>
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: 13.5, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 12.5, marginTop: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  tick: { fontSize: 14, fontWeight: '800' },
  checkText: { flex: 1 },
});
