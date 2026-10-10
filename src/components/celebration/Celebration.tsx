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

/**
 * Fireworks, crackers and confetti for about 3 s (~100 particles). Colors come from the theme.
 * With Reduce Motion on, nothing is drawn.
 */
export function Fireworks({
  colors,
  playKey = 0,
  center,
}: {
  colors: readonly string[];
  /** Change to play again. */
  playKey?: number;
  /** Where the heart burst starts (defaults to the middle of the screen). */
  center?: { x: number; y: number };
}) {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const bursts = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const confetti = useRef(new Animated.Value(0)).current;
  const hearts = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    [...bursts, confetti, hearts].forEach(v => v.setValue(0));
    const anim = Animated.parallel([
      Animated.stagger(
        450,
        bursts.map(v =>
          Animated.timing(v, {
            toValue: 1,
            duration: 1300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.timing(confetti, {
        toValue: 1,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(hearts, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduce, playKey, bursts, confetti, hearts]);

  const layout = useMemo(() => {
    const rand = seeded(width + height);
    const burstSpots = [
      { x: width * 0.25, y: height * 0.2 },
      { x: width * 0.75, y: height * 0.16 },
      { x: width * 0.5, y: height * 0.3 },
    ];
    const sparks = burstSpots.map((spot, b) =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + b * 0.3;
        const r = 70 + rand() * 50;
        return {
          key: `${b}-${i}`,
          spot,
          dx: Math.cos(angle) * r,
          dy: Math.sin(angle) * r,
          color: colors[(i + b) % colors.length]!,
          size: 5 + Math.round(rand() * 4),
        };
      }),
    );
    const flakes = Array.from({ length: 40 }, (_, i) => {
      const start = rand() * 0.35;
      return {
        key: i,
        x: rand() * width,
        start,
        end: Math.min(1, start + 0.55 + rand() * 0.1),
        drift: (rand() - 0.5) * 80,
        spin: rand() > 0.5 ? 1 : -1,
        color: colors[i % colors.length]!,
        w: 6 + Math.round(rand() * 4),
        h: 10 + Math.round(rand() * 6),
      };
    });
    const loveBits = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const r = 90 + rand() * 60;
      return { key: i, dx: Math.cos(angle) * r, dy: Math.sin(angle) * r, emoji: i % 2 ? '💗' : '💘' };
    });
    return { sparks, flakes, loveBits };
  }, [width, height, colors]);

  if (reduce) return null;
  const c = center ?? { x: width / 2, y: height * 0.38 };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layout.sparks.map((group, b) =>
        group.map(s => {
          const v = bursts[b]!;
          return (
            <Animated.View
              key={s.key}
              style={[
                styles.spark,
                {
                  left: s.spot.x,
                  top: s.spot.y,
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size / 2,
                  backgroundColor: s.color,
                  opacity: v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
                  transform: [
                    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
                    {
                      translateY: v.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, s.dy + 30],
                      }),
                    },
                    { scale: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.6] }) },
                  ],
                },
              ]}
            />
          );
        }),
      )}
      {layout.flakes.map(f => (
        <Animated.View
          key={f.key}
          style={[
            styles.flake,
            {
              left: f.x,
              width: f.w,
              height: f.h,
              backgroundColor: f.color,
              opacity: confetti.interpolate({
                inputRange: [0, f.start, f.start + 0.02, f.end - 0.08, f.end, 1],
                outputRange: [0, 0, 1, 1, 0, 0],
              }),
              transform: [
                {
                  translateY: confetti.interpolate({
                    inputRange: [0, f.start, f.end, 1],
                    outputRange: [-30, -30, height + 30, height + 30],
                  }),
                },
                {
                  translateX: confetti.interpolate({
                    inputRange: [0, f.start, f.end, 1],
                    outputRange: [0, 0, f.drift, f.drift],
                  }),
                },
                {
                  rotate: confetti.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${f.spin * 720}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      {layout.loveBits.map(h => (
        <Animated.Text
          key={h.key}
          style={[
            styles.loveBit,
            {
              left: c.x - 12,
              top: c.y - 14,
              opacity: hearts.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [
                { translateX: hearts.interpolate({ inputRange: [0, 1], outputRange: [0, h.dx] }) },
                { translateY: hearts.interpolate({ inputRange: [0, 1], outputRange: [0, h.dy] }) },
                { scale: hearts.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 0.8] }) },
              ],
            },
          ]}
        >
          {h.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heart: { position: 'absolute', top: 0 },
  spark: { position: 'absolute' },
  flake: { position: 'absolute', top: 0, borderRadius: 2 },
  loveBit: { position: 'absolute', fontSize: 22 },
});
