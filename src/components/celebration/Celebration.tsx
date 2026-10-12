import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useReduceMotion } from '@/components/ui/SkeletonLoader';

/** Deterministic pseudo-random numbers so particles don't jump between renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Hearts drifting up behind content. One looping value drives every heart (cheap, native
 * driver). Nothing is drawn with Reduce Motion on.
 */
export function FloatingHearts({
  count = 12,
  opacity = 0.9,
  emojis = ['💗', '💘', '💕'],
  duration = 9000,
}: {
  count?: number;
  opacity?: number;
  emojis?: readonly string[];
  duration?: number;
}) {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t, duration]);

  const hearts = useMemo(() => {
    const rand = seeded(count * 7 + 3);
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      x: rand() * (width - 30),
      phase: 0.03 + (i / count) * 0.94,
      size: 16 + Math.round(rand() * 16),
      sway: 10 + rand() * 18,
      emoji: emojis[i % emojis.length]!,
    }));
  }, [count, width, emojis]);

  if (reduce) return null;
  const bottom = height + 40;
  const travel = height + 120;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {hearts.map(h => {
        const cut = 1 - h.phase;
        const translateY = t.interpolate({
          inputRange: [0, cut, cut + 0.0001, 1],
          outputRange: [
            bottom - h.phase * travel,
            bottom - travel,
            bottom,
            bottom - h.phase * travel,
          ],
        });
        const translateX = t.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, h.sway, 0, -h.sway, 0],
        });
        return (
          <Animated.Text
            key={h.key}
            style={[
              styles.heart,
              {
                left: h.x,
                fontSize: h.size,
                transform: [{ translateY }, { translateX }],
              },
            ]}
          >
            {h.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const clamp = { extrapolate: 'clamp' as const };

/**
 * One short burst. Few views, styles built once, no animated emoji text.
 * The old burst built ~100 native nodes on every render and animated emoji
 * with the native driver, which kills the process on some Android phones
 * the moment this screen opens.
 */
export function Fireworks({
  colors,
  playKey = 0,
}: {
  colors: readonly string[];
  /** Change to play again. */
  playKey?: number;
  /** Kept so older call sites still type-check. The burst no longer uses it. */
  center?: { x: number; y: number };
  /** Kept so older call sites still type-check. Emoji bits are not drawn. */
  hearts?: boolean;
}) {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || width < 1 || height < 1) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, playKey, progress, width, height]);

  const pieces = useMemo(() => {
    if (width < 1 || height < 1 || colors.length === 0) return [];
    const rand = seeded(width + height + colors.length);
    const spots = [
      { x: width * 0.28, y: height * 0.22 },
      { x: width * 0.72, y: height * 0.18 },
      { x: width * 0.5, y: height * 0.32 },
    ];
    return spots.flatMap((spot, b) =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2 + b;
        const reach = 56 + rand() * 36;
        const size = 6 + Math.round(rand() * 3);
        const color = colors[(i + b) % colors.length]!;
        return {
          key: `${b}-${i}`,
          x: spot.x,
          y: spot.y,
          style: {
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: progress.interpolate({
              inputRange: [0, 0.12, 0.7, 1],
              outputRange: [0, 1, 1, 0],
              ...clamp,
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(angle) * reach],
                  ...clamp,
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(angle) * reach + 24],
                  ...clamp,
                }),
              },
            ],
          },
        };
      }),
    );
  }, [width, height, colors, progress]);

  if (reduce || pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map(p => (
        <View key={p.key} pointerEvents="none" style={[styles.spark, { left: p.x, top: p.y }]}>
          <Animated.View style={p.style} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heart: { position: 'absolute', top: 0 },
  spark: { position: 'absolute' },
});
