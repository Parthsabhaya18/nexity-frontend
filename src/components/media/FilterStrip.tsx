import type { SkImage } from '@shopify/react-native-skia';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import {
  FILTER_IDS,
  FILTER_LABELS,
  type FilterId,
  filterMatrix,
} from '@/features/media/filterEngine';
import { radius, spacing, useAppTheme } from '@/theme';

import { FilteredImage } from './FilteredImage';

type Props = {
  /** The photo being edited, decoded once with Skia's `useImage`; null while loading. */
  image: SkImage | null;
  value: FilterId;
  onChange: (id: FilterId) => void;
  /** Tapping the selected filter again (e.g. to open its intensity slider). */
  onReselect?: (id: FilterId) => void;
};

const THUMB_W = 68;
const THUMB_H = 84;

/** Instagram-style filter row: each thumbnail is the current photo with that filter, live. */
export function FilterStrip({ image, value, onChange, onReselect }: Props) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {FILTER_IDS.map(id => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => (selected ? onReselect?.(id) : onChange(id))}
            accessibilityRole="tab"
            accessibilityLabel={`${FILTER_LABELS[id]} filter`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.text : colors.textSecondary },
                selected && styles.labelSelected,
              ]}
              numberOfLines={1}
            >
              {FILTER_LABELS[id]}
            </Text>
            <View
              style={[
                styles.thumb,
                selected ? { borderColor: colors.text } : styles.unselected,
              ]}
            >
              {image ? (
                <FilteredImage
                  image={image}
                  width={THUMB_W}
                  height={THUMB_H}
                  matrix={filterMatrix(id)}
                />
              ) : (
                <SkeletonLoader
                  width={THUMB_W}
                  height={THUMB_H}
                  radius={radius.sm}
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  item: { alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '500' },
  labelSelected: { fontWeight: '800' },
  thumb: {
    width: THUMB_W + 4,
    height: THUMB_H + 4,
    padding: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselected: { borderColor: 'transparent' },
  pressed: { opacity: 0.75 },
});
