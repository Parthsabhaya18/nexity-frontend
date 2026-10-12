import { useImage } from '@shopify/react-native-skia';
import { Maximize2, Minimize2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { type ColorMatrix, isIdentity } from '@/features/media/filterEngine';
import {
  baseSize,
  clampPan,
  defaultFitMode,
  type FitMode,
  type FitTransform,
  MAX_ZOOM,
  type Size,
  STORY_RATIO,
} from '@/features/media/mediaFit';
import { useOrientedSize } from '@/features/media/useOrientedSize';
import { darkScreen, radius, useAppTheme } from '@/theme';

import { FilteredImage } from './FilteredImage';

type Props = {
  uri: string;
  /** Display width; the height follows from `ratio`. */
  width: number;
  /** Canvas ratio (width / height). Stories: 9:16 (default). Posts: 1, 4/5, 1.91. */
  ratio?: number;
  /** Start from a saved transform instead of the automatic fit / fill. */
  initial?: FitTransform;
  /** Called after every gesture or toggle with the settled transform (for `bakeImage`). */
  onChange?: (t: FitTransform, source: Size) => void;
  /** Live filter + adjustments from `lookMatrix`. */
  matrix?: ColorMatrix;
  /** Shows the Fit / Fill toggle (default true). */
  showToggle?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const BLUR = 24;

/**
 * Places a photo on a fixed-ratio canvas: fills it when the ratios are within
 * 5%, otherwise fits the whole photo over a blurred copy of itself (no black
 * bars, never stretched). Pinch to zoom, drag to reposition, Fit/Fill toggle.
 */
export function MediaFit({
  uri,
  width,
  ratio = STORY_RATIO,
  initial,
  onChange,
  matrix,
  showToggle = true,
  accessibilityLabel = 'Photo',
  style,
}: Props) {
  const { colors } = useAppTheme();
  const frame: Size = { width, height: Math.round(width / ratio) };
  const { size: source, error } = useOrientedSize(uri);
  const filtered = !!matrix && !isIdentity(matrix);
  const skImage = useImage(filtered ? uri : null);
  const [mode, setMode] = useState<FitMode | null>(initial?.mode ?? null);

  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef({ zoom: 1, x: 0, y: 0 });
  const gesture = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    baseZoom: 1,
    baseX: 0,
    baseY: 0,
    startDist: 1,
    startMid: { x: 0, y: 0 } as Pt,
    startPt: { x: 0, y: 0 } as Pt,
  });
  const latest = useRef({ frame, source, mode, onChange });
  latest.current = { frame, source, mode, onChange };

  // Pick fit or fill once the photo's real size is known.
  useEffect(() => {
    if (!source || mode) return;
    setMode(defaultFitMode(source, ratio));
  }, [source, mode, ratio]);

  // Apply a saved transform once.
  const restored = useRef(false);
  useEffect(() => {
    if (!initial || restored.current || !source) return;
    restored.current = true;
    const x = initial.x * frame.width;
    const y = initial.y * frame.height;
    cur.current = { zoom: initial.zoom, x, y };
    scale.setValue(initial.zoom);
    tx.setValue(x);
    ty.setValue(y);
  }, [initial, source, frame.width, frame.height, scale, tx, ty]);

  const report = () => {
    const l = latest.current;
    if (!l.source || !l.mode) return;
    l.onChange?.(
      {
        mode: l.mode,
        zoom: cur.current.zoom,
        x: cur.current.x / l.frame.width,
        y: cur.current.y / l.frame.height,
      },
      l.source,
    );
  };

  const apply = (zoom: number, x: number, y: number) => {
    cur.current = { zoom, x, y };
    scale.setValue(zoom);
    tx.setValue(x);
    ty.setValue(y);
  };

  const animateTo = (zoom: number, x: number, y: number) => {
    cur.current = { zoom, x, y };
    Animated.parallel(
      (
        [
          [scale, zoom],
          [tx, x],
          [ty, y],
        ] as const
      ).map(([v, to]) =>
        Animated.timing(v, {
          toValue: to,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
    report();
  };

  const settle = () => {
    const { frame: f, source: s, mode: m } = latest.current;
    if (!s || !m) return;
    const c = cur.current;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom));
    const base = baseSize(s, f, m);
    const p = clampPan(
      { width: base.width * zoom, height: base.height * zoom },
      f,
      c.x,
      c.y,
    );
    if (zoom !== c.zoom || p.x !== c.x || p.y !== c.y)
      animateTo(zoom, p.x, p.y);
    else report();
  };

  const points = (touches: ReadonlyArray<{ pageX: number; pageY: number }>) =>
    touches.map(t => ({ x: t.pageX, y: t.pageY }));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        gesture.current.mode = 'none';
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
            g.baseZoom = c.zoom;
            g.baseX = c.x;
            g.baseY = c.y;
            g.startDist = Math.max(1, dist(p[0]!, p[1]!));
            g.startMid = mid(p[0]!, p[1]!);
          }
          const m = mid(p[0]!, p[1]!);
          const zoom = Math.min(
            MAX_ZOOM * 1.2,
            Math.max(0.7, (g.baseZoom * dist(p[0]!, p[1]!)) / g.startDist),
          );
          apply(
            zoom,
            g.baseX + (m.x - g.startMid.x),
            g.baseY + (m.y - g.startMid.y),
          );
          return;
        }
        if (p.length === 1) {
          if (g.mode !== 'pan') {
            g.mode = 'pan';
            g.baseX = c.x;
            g.baseY = c.y;
            g.startPt = p[0]!;
          }
          apply(
            c.zoom,
            g.baseX + p[0]!.x - g.startPt.x,
            g.baseY + p[0]!.y - g.startPt.y,
          );
        }
      },
      onPanResponderRelease: () => {
        gesture.current.mode = 'none';
        settle();
      },
      onPanResponderTerminate: () => {
        gesture.current.mode = 'none';
        settle();
      },
    }),
  ).current;

  const toggle = () => {
    if (!mode) return;
    const next: FitMode = mode === 'fit' ? 'fill' : 'fit';
    latest.current.mode = next;
    setMode(next);
    animateTo(1, 0, 0);
  };

  const base = source && mode ? baseSize(source, frame, mode) : null;

  return (
    <View
      style={[
        styles.frame,
        {
          width: frame.width,
          height: frame.height,
          backgroundColor: colors.surfaceAlt,
        },
        style,
      ]}
      {...pan.panHandlers}
    >
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Pinch to zoom and drag to reposition"
      >
        {error ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>
              Couldn't load this photo.
            </Text>
          </View>
        ) : !source || !base ? (
          <SkeletonLoader
            width={frame.width}
            height={frame.height}
            radius={0}
          />
        ) : (
          <>
            {filtered && skImage ? (
              <FilteredImage
                image={skImage}
                width={frame.width}
                height={frame.height}
                matrix={matrix}
                blur={BLUR}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Image
                source={{ uri }}
                blurRadius={BLUR}
                resizeMode="cover"
                style={StyleSheet.absoluteFill}
              />
            )}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.layer,
                {
                  left: (frame.width - base.width) / 2,
                  top: (frame.height - base.height) / 2,
                  width: base.width,
                  height: base.height,
                  transform: [{ translateX: tx }, { translateY: ty }, { scale }],
                },
              ]}
            >
              {filtered && skImage ? (
                <FilteredImage
                  image={skImage}
                  width={base.width}
                  height={base.height}
                  matrix={matrix}
                  fit="fill"
                />
              ) : (
                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
              )}
            </Animated.View>
          </>
        )}
      </View>

      {showToggle && mode ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'fit' ? 'Fill the frame' : 'Fit the whole photo'
          }
          hitSlop={8}
          style={({ pressed }) => [
            styles.toggle,
            { backgroundColor: colors.overlay },
            pressed && styles.pressed,
          ]}
        >
          {mode === 'fit' ? (
            <Maximize2 size={16} color={darkScreen.text} />
          ) : (
            <Minimize2 size={16} color={darkScreen.text} />
          )}
          <Text style={[styles.toggleText, { color: darkScreen.text }]}>
            {mode === 'fit' ? 'Fill' : 'Fit'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  layer: { position: 'absolute' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggle: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
