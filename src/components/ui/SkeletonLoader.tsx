import { useEffect, useId, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  type DimensionValue,
  Easing,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { radius as radii, useAppTheme } from '@/theme';

type Props = {
  variant?: 'rect' | 'circle' | 'line';
  width?: DimensionValue;
  height?: number;
  /** Diameter for `circle`. */
  size?: number;
  radius?: number;
  /** `line` only: number of text lines; the last one is shorter. */
  lines?: number;
  shimmer?: boolean;
  style?: ViewStyle;
};

const LINE_HEIGHT = 12;
const LINE_GAP = 8;
const SWEEP_MS = 1300;

/** One clock for every skeleton on screen, so they shimmer in step. */
const clock = new Animated.Value(0);
let users = 0;
let loop: Animated.CompositeAnimation | null = null;

function useShimmerClock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    users += 1;
    if (!loop) {
      clock.setValue(0);
      loop = Animated.loop(
        Animated.timing(clock, {
          toValue: 1,
          duration: SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loop.start();
    }
    return () => {
      users -= 1;
      if (users === 0 && loop) {
        loop.stop();
        loop = null;
      }
    };
  }, [enabled]);
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return reduce;
}

function Bone({
  width,
  height,
  radius,
  shimmer,
  style,
}: {
  width: DimensionValue;
  height: number;
  radius: number;
  shimmer: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  const [measured, setMeasured] = useState(0);
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const translateX = clock.interpolate({
    inputRange: [0, 1],
    outputRange: [-measured, measured],
  });

  return (
    <View
      onLayout={e => setMeasured(e.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.bone,
        { width, height, borderRadius: radius, backgroundColor: colors.skeleton },
        style,
      ]}
    >
      {shimmer && measured > 0 ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop
                  offset="0"
                  stopColor={colors.skeletonHighlight}
                  stopOpacity={0}
                />
                <Stop
                  offset="0.5"
                  stopColor={colors.skeletonHighlight}
                  stopOpacity={0.9}
                />
                <Stop
                  offset="1"
                  stopColor={colors.skeletonHighlight}
                  stopOpacity={0}
                />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Placeholder with the exact size of the content it stands in for, so nothing
 * jumps when the content arrives. Hidden from screen readers; label the
 * loading container instead.
 */
export function SkeletonLoader({
  variant = 'rect',
  width,
  height,
  size = 40,
  radius,
  lines = 1,
  shimmer = true,
  style,
}: Props) {
  const reduceMotion = useReduceMotion();
  const animate = shimmer && !reduceMotion;
  useShimmerClock(animate);

  if (variant === 'circle') {
    return (
      <Bone
        width={size}
        height={size}
        radius={size / 2}
        shimmer={animate}
        style={style}
      />
    );
  }

  if (variant === 'line') {
    return (
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.lines, { width: width ?? '100%' }, style]}
      >
        {Array.from({ length: lines }, (_, i) => (
          <Bone
            key={i}
            width={lines > 1 && i === lines - 1 ? '60%' : '100%'}
            height={height ?? LINE_HEIGHT}
            radius={radius ?? (height ?? LINE_HEIGHT) / 2}
            shimmer={animate}
          />
        ))}
      </View>
    );
  }

  return (
    <Bone
      width={width ?? '100%'}
      height={height ?? 120}
      radius={radius ?? radii.sm}
      shimmer={animate}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  bone: { overflow: 'hidden' },
  lines: { gap: LINE_GAP },
});
