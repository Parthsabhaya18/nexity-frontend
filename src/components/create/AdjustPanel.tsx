import {
  Aperture,
  Blend,
  Circle,
  Contrast,
  Droplet,
  Sun,
  Thermometer,
  Triangle,
} from 'lucide-react-native';
import { type ComponentType, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Slider } from '@/components/ui/Slider';
import {
  type Adjustments,
  hasAdjustments,
  ZERO_ADJUSTMENTS,
} from '@/features/create/adjustments';
import { radius, spacing, useAppTheme } from '@/theme';

type Tool = {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  Icon: ComponentType<{ size?: number; color?: string }>;
};

const TOOLS: Tool[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, Icon: Sun },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, Icon: Contrast },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, Icon: Droplet },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100, Icon: Thermometer },
  { key: 'fade', label: 'Fade', min: 0, max: 100, Icon: Blend },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100, Icon: Triangle },
  { key: 'blur', label: 'Blur', min: 0, max: 100, Icon: Aperture },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, Icon: Circle },
];

type Props = {
  value: Adjustments;
  onChange: (next: Adjustments) => void;
};

/**
 * Pick a tool, drag its slider; the photo above updates live. The numbers are
 * saved with the post, so everyone sees the same look.
 */
export function AdjustPanel({ value, onChange }: Props) {
  const { colors } = useAppTheme();
  const [active, setActive] = useState<keyof Adjustments>('brightness');
  const tool = TOOLS.find(t => t.key === active)!;
  const current = Math.round(value[active]);
  const edited = hasAdjustments(value);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tools}
        accessibilityRole="tablist"
      >
        {TOOLS.map(t => {
          const on = t.key === active;
          const changed = value[t.key] !== 0;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActive(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              style={[
                styles.tool,
                {
                  backgroundColor: on ? colors.primarySoft : colors.surfaceAlt,
                  borderColor: on ? colors.primary : 'transparent',
                },
              ]}
            >
              <t.Icon size={20} color={on ? colors.primary : colors.text} />
              <Text
                style={[
                  styles.toolLabel,
                  { color: on ? colors.primary : colors.text },
                ]}
              >
                {t.label}
              </Text>
              {changed ? (
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sliderBlock}>
        <View style={styles.sliderHead}>
          <Text style={[styles.sliderName, { color: colors.text }]}>
            {tool.label}
          </Text>
          <Text
            style={[
              styles.sliderValue,
              { color: current === 0 ? colors.textSecondary : colors.primary },
            ]}
          >
            {current > 0 && tool.min < 0 ? `+${current}` : current}
          </Text>
        </View>
        <Slider
          value={value[active]}
          min={tool.min}
          max={tool.max}
          centered={tool.min < 0}
          onChange={n => onChange({ ...value, [active]: n })}
          accessibilityLabel={tool.label}
        />
      </View>

      <Pressable
        onPress={() => onChange(ZERO_ADJUSTMENTS)}
        disabled={!edited}
        accessibilityRole="button"
        accessibilityLabel="Reset all adjustments"
        style={[styles.reset, !edited && styles.resetOff]}
      >
        <Text style={[styles.resetText, { color: colors.primary }]}>
          Reset all
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm },
  tools: { gap: 8, paddingHorizontal: spacing.md },
  tool: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  toolLabel: { fontSize: 12, fontWeight: '700' },
  dot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
  sliderBlock: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderName: { fontSize: 15, fontWeight: '800' },
  sliderValue: { fontSize: 15, fontWeight: '800' },
  reset: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  resetOff: { opacity: 0.35 },
  resetText: { fontSize: 14, fontWeight: '700' },
});
