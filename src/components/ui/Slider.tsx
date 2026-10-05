import { useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Colours the track from the centre (for -100…100 sliders). */
  centered?: boolean;
  accessibilityLabel: string;
  step?: number;
};

const THUMB = 28;
const TRACK = 4;

/** Drag-to-set slider. Works in a ScrollView: it keeps the touch while dragging. */
export function Slider({
  value,
  min,
  max,
  onChange,
  centered,
  accessibilityLabel,
  step = 1,
}: Props) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const latest = useRef({ width, min, max, step, onChange });
  latest.current = { width, min, max, step, onChange };

  const setFromX = (x: number) => {
    const s = latest.current;
    const usable = Math.max(1, s.width - THUMB);
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    const raw = s.min + ratio * (s.max - s.min);
    s.onChange(Math.round(raw / s.step) * s.step);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: evt => setFromX(evt.nativeEvent.locationX),
      onPanResponderMove: evt => setFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  const ratio = (Math.min(max, Math.max(min, value)) - min) / (max - min || 1);
  const usable = Math.max(0, width - THUMB);
  const thumbLeft = ratio * usable;
  const mid = centered ? ((0 - min) / (max - min)) * usable : 0;
  const fillLeft = centered ? Math.min(mid, thumbLeft) : 0;
  const fillWidth = centered
    ? Math.abs(thumbLeft - mid)
    : thumbLeft + THUMB / 2;

  return (
    <View
      style={styles.hit}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: Math.round(value) }}
      accessibilityActions={[
        { name: 'increment' },
        { name: 'decrement' },
      ]}
      onAccessibilityAction={e => {
        const delta = e.nativeEvent.actionName === 'increment' ? 10 : -10;
        onChange(Math.min(max, Math.max(min, value + delta)));
      }}
      {...pan.panHandlers}
    >
      <View
        pointerEvents="none"
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          style={{
            position: 'absolute',
            height: TRACK,
            borderRadius: TRACK / 2,
            backgroundColor: colors.primary,
            left: centered ? THUMB / 2 + fillLeft : 0,
            width: fillWidth,
          }}
        />
        {centered ? (
          <View
            style={[
              styles.centerMark,
              { left: THUMB / 2 + mid - 1, backgroundColor: colors.textSecondary },
            ]}
          />
        ) : null}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            backgroundColor: colors.surface,
            borderColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 48, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2 },
  centerMark: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: TRACK + 8,
    borderRadius: 1,
  },
  thumb: {
    position: 'absolute',
    top: (48 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
