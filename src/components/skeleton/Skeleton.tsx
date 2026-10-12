import { type ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  type DimensionValue,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { radius as radii, spacing } from '@/theme';

export { SkeletonDarkTone } from '@/components/ui/SkeletonLoader';
export const Skeleton = SkeletonLoader;

const FADE_DELAY_MS = 120;
const FADE_MS = 220;

/**
 * Wraps a whole loading layout: fades in after a beat so a fast response never
 * flashes bones, and gives screen readers one "Loading" label for everything.
 */
export function SkeletonGroup({
  children,
  style,
  label = 'Loading',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      delay: FADE_DELAY_MS,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      pointerEvents="none"
      style={[style, { opacity }]}
    >
      {children}
    </Animated.View>
  );
}

export function SkeletonRect({
  width,
  height,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonLoader width={width} height={height} radius={radius} style={style} />
  );
}

export function SkeletonCircle({ size, style }: { size: number; style?: ViewStyle }) {
  return <SkeletonLoader variant="circle" size={size} style={style} />;
}

export const SkeletonAvatar = SkeletonCircle;

/** One bar per text line; `height` is the bar, not the line box. */
export function SkeletonText({
  width = '100%',
  height = 12,
  lines = 1,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  lines?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonLoader
      variant="line"
      width={width}
      height={height}
      lines={lines}
      style={style}
    />
  );
}

/** Square-cornered media placeholder; fills its parent unless sized. */
export function SkeletonImage({
  width = '100%',
  height = '100%',
  radius = 0,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonLoader width={width} height={height} radius={radius} style={style} />
  );
}

/** Avatar with a name line and a shorter second line, like `UserRow`. */
export function SkeletonListItem({
  avatar = 48,
  titleWidth = '42%',
  subtitleWidth = '28%',
  trailing,
  style,
}: {
  avatar?: number;
  titleWidth?: DimensionValue;
  subtitleWidth?: DimensionValue | null;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.item, style]}>
      <SkeletonCircle size={avatar} />
      <View style={styles.itemText}>
        <SkeletonText width={titleWidth} height={12} />
        {subtitleWidth ? (
          <SkeletonText width={subtitleWidth} height={10} />
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

/** Rounded block with a title and body lines, for generic cards. */
export function SkeletonCard({
  height = 120,
  lines = 2,
  style,
}: {
  height?: number;
  lines?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonRect height={height} radius={radii.md} />
      <SkeletonText width="60%" height={12} />
      <SkeletonText lines={lines} height={10} />
    </View>
  );
}

/** A list's next page is on its way. */
export function SkeletonFooter({
  rows = 2,
  avatar = 48,
}: {
  rows?: number;
  avatar?: number;
}) {
  return (
    <SkeletonGroup label="Loading more">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListItem key={i} avatar={avatar} />
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  itemText: { flex: 1, gap: 8 },
  card: { gap: 10, padding: spacing.md },
});
