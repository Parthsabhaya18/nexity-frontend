import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LOOKS, lookTint } from '@/features/media/looks';
import { useAppTheme } from '@/theme';

export function LookStrip({
  value,
  onChange,
  tone = 'theme',
}: {
  value: string;
  onChange: (id: string) => void;
  /** Story editor sits on a black canvas. Reel details follow the app theme. */
  tone?: 'dark' | 'theme';
}) {
  const { colors } = useAppTheme();
  const ink = tone === 'dark' ? '#FFFFFF' : colors.text;
  const line = tone === 'dark' ? 'rgba(255,255,255,0.28)' : colors.border;
  const onBg = tone === 'dark' ? 'rgba(255,255,255,0.16)' : colors.surfaceAlt;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {LOOKS.map(look => {
        const on = look.id === value;
        return (
          <Pressable
            key={look.id}
            onPress={() => onChange(look.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${look.name} filter`}
            style={[
              styles.chip,
              {
                borderColor: on ? ink : line,
                backgroundColor: on ? onBg : 'transparent',
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: look.swatch }]} />
            <Text style={[styles.label, { color: ink }]}>{look.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Soft colour wash so a saved look is visible on a photo or video. */
export function LookTint({ id }: { id?: string | null }) {
  const color = lookTint(id);
  if (!color) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 13, fontWeight: '700' },
});
