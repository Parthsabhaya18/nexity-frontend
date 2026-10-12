import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  type Adjustments,
  hasAdjustments,
  ZERO_ADJUSTMENTS,
} from '@/features/create/adjustments';

type Props = {
  adjustments?: Adjustments | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Replays saved photo edits: tint, fade, contrast and a vignette. */
export function FilterFrame({ adjustments, style, children }: Props) {
  const look = adjustments ?? ZERO_ADJUSTMENTS;
  if (!hasAdjustments(look)) return <View style={style}>{children}</View>;

  const bright = look.brightness / 100;
  const warm = look.warmth / 100;
  const fade = look.fade / 100;
  const contrast = Math.max(0, look.contrast) / 100;
  const sat = look.saturation / 100;
  const sharp = look.sharpen / 100;

  return (
    <View style={[styles.fill, style]}>
      {children}
      {bright !== 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: bright > 0 ? '#FFFFFF' : '#000000',
              opacity: Math.min(0.55, Math.abs(bright) * 0.55),
            },
          ]}
        />
      ) : null}
      {warm !== 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: warm > 0 ? '#FF8A3D' : '#6AA7FF',
              opacity: Math.min(0.4, Math.abs(warm) * 0.4),
            },
          ]}
        />
      ) : null}
      {fade > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#FFFFFF', opacity: fade * 0.45 },
          ]}
        />
      ) : null}
      {contrast > 0 || sharp > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#000000',
              opacity: Math.min(0.35, contrast * 0.28 + sharp * 0.12),
            },
          ]}
        />
      ) : null}
      {sat !== 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: sat > 0 ? '#FF4D6D' : '#8D8D8D',
              opacity: Math.min(0.28, Math.abs(sat) * 0.28),
            },
          ]}
        />
      ) : null}
      {look.vignette > 0 ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
        >
          <Defs>
            <RadialGradient id="vignette" cx="50%" cy="50%" r="55%">
              <Stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <Stop
                offset="100%"
                stopColor="#000000"
                stopOpacity={look.vignette / 100}
              />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#vignette)" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
});
