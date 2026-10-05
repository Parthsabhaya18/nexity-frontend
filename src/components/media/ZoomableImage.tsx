import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, PanResponder, StyleSheet, View } from 'react-native';

type Props = {
  uri: string;
  /** Size of the area that receives the gestures. */
  width: number;
  height: number;
  maxScale?: number;
  accessibilityLabel?: string;
  /** A single tap, after the double-tap window has passed. */
  onTap?: () => void;
};

const DOUBLE_TAP_MS = 260;
const TAP_SLOP = 10;
const DOUBLE_TAP_SCALE = 2.5;

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Photo with pinch-to-zoom, drag while zoomed and double-tap to zoom in or
 * out. Built on touches so it works inside a Modal without extra native code.
 */
export function ZoomableImage({
  uri,
  width,
  height,
  maxScale = 5,
  accessibilityLabel,
  onTap,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef({ scale: 1, x: 0, y: 0 });
  const gesture = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    baseScale: 1,
    baseX: 0,
    baseY: 0,
    startDist: 1,
    startMid: { x: 0, y: 0 } as Pt,
    startPt: { x: 0, y: 0 } as Pt,
    startedAt: 0,
    moved: false,
  });
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const props = useRef({ width, height, maxScale, onTap });
  props.current = { width, height, maxScale, onTap };

  const apply = (s: number, x: number, y: number) => {
    cur.current = { scale: s, x, y };
    scale.setValue(s);
    tx.setValue(x);
    ty.setValue(y);
  };

  const bound = (s: number, x: number, y: number) => {
    const maxX = Math.max(0, (props.current.width * (s - 1)) / 2);
    const maxY = Math.max(0, (props.current.height * (s - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const animateTo = (s: number, x: number, y: number) => {
    cur.current = { scale: s, x, y };
    Animated.parallel(
      [
        [scale, s],
        [tx, x],
        [ty, y],
      ].map(([v, to]) =>
        Animated.timing(v as Animated.Value, {
          toValue: to as number,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const points = (touches: ReadonlyArray<{ pageX: number; pageY: number }>) =>
    touches.map(t => ({ x: t.pageX, y: t.pageY }));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: evt => {
        const g = gesture.current;
        const p = points(evt.nativeEvent.touches as never);
        g.mode = 'none';
        g.moved = false;
        g.startedAt = Date.now();
        g.startPt = p[0] ?? { x: 0, y: 0 };
        scale.stopAnimation();
        tx.stopAnimation();
        ty.stopAnimation();
      },
      onPanResponderMove: evt => {
        const g = gesture.current;
        const p = points(evt.nativeEvent.touches as never);
        const c = cur.current;
        if (p.length >= 2) {
          if (g.mode !== 'pinch') {
            g.mode = 'pinch';
            g.baseScale = c.scale;
            g.baseX = c.x;
            g.baseY = c.y;
            g.startDist = Math.max(1, dist(p[0]!, p[1]!));
            g.startMid = mid(p[0]!, p[1]!);
          }
          g.moved = true;
          const m = mid(p[0]!, p[1]!);
          const s = Math.min(
            props.current.maxScale * 1.2,
            Math.max(0.6, (g.baseScale * dist(p[0]!, p[1]!)) / g.startDist),
          );
          apply(s, g.baseX + (m.x - g.startMid.x), g.baseY + (m.y - g.startMid.y));
          return;
        }
        if (p.length === 1) {
          if (g.mode !== 'pan') {
            g.mode = 'pan';
            g.baseX = c.x;
            g.baseY = c.y;
            g.startPt = p[0]!;
          }
          const dx = p[0]!.x - g.startPt.x;
          const dy = p[0]!.y - g.startPt.y;
          if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
          if (c.scale > 1.01) {
            const b = bound(c.scale, g.baseX + dx, g.baseY + dy);
            apply(c.scale, b.x, b.y);
          }
        }
      },
      onPanResponderRelease: () => {
        const g = gesture.current;
        const c = cur.current;
        const wasTap = !g.moved && Date.now() - g.startedAt < 300;
        g.mode = 'none';
        if (wasTap) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            clearTimeout(tapTimer.current);
            lastTap.current = 0;
            if (c.scale > 1.05) animateTo(1, 0, 0);
            else animateTo(DOUBLE_TAP_SCALE, 0, 0);
          } else {
            lastTap.current = now;
            tapTimer.current = setTimeout(() => props.current.onTap?.(), DOUBLE_TAP_MS);
          }
          return;
        }
        if (c.scale < 1.02) {
          animateTo(1, 0, 0);
          return;
        }
        const s = Math.min(props.current.maxScale, c.scale);
        const b = bound(s, c.x, c.y);
        if (s !== c.scale || b.x !== c.x || b.y !== c.y) animateTo(s, b.x, b.y);
      },
      onPanResponderTerminate: () => {
        gesture.current.mode = 'none';
        const c = cur.current;
        if (c.scale < 1.02) animateTo(1, 0, 0);
      },
    }),
  ).current;

  return (
    <View style={{ width, height }} {...pan.panHandlers}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
        ]}
      >
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>
    </View>
  );
}
