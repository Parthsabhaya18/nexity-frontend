import { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  durationMs: number;
  startMs: number;
  endMs: number;
  maxMs: number;
  onChange: (startMs: number, endMs: number) => void;
};

const MIN_MS = 1000;

function label(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Start and end handles for the piece of a video that will be posted. */
export function TrimBar({ durationMs, startMs, endMs, maxMs, onChange }: Props) {
  const { colors } = useAppTheme();
  const width = useRef(1);
  const origin = useRef({ startMs, endMs });
  const live = useRef({ durationMs, maxMs, onChange, startMs, endMs });
  live.current = { durationMs, maxMs, onChange, startMs, endMs };

  const startPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        origin.current = {
          startMs: live.current.startMs,
          endMs: live.current.endMs,
        };
      },
      onPanResponderMove: (_evt, gesture) => {
        const now = live.current;
        const delta = (gesture.dx / width.current) * now.durationMs;
        const next = Math.max(
          0,
          Math.min(origin.current.startMs + delta, origin.current.endMs - MIN_MS),
        );
        const end = Math.min(origin.current.endMs, next + now.maxMs);
        now.onChange(next, Math.max(end, next + MIN_MS));
      },
    }),
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        origin.current = {
          startMs: live.current.startMs,
          endMs: live.current.endMs,
        };
      },
      onPanResponderMove: (_evt, gesture) => {
        const now = live.current;
        const delta = (gesture.dx / width.current) * now.durationMs;
        const next = Math.min(
          now.durationMs,
          Math.max(origin.current.endMs + delta, origin.current.startMs + MIN_MS),
        );
        const start = Math.max(origin.current.startMs, next - now.maxMs);
        now.onChange(Math.min(start, next - MIN_MS), next);
      },
    }),
  ).current;

  const left = (startMs / durationMs) * 100;
  const endLeft = (endMs / durationMs) * 100;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.time, { color: colors.text }]}>
        {label(startMs)} – {label(endMs)} · {label(endMs - startMs)} selected
      </Text>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
        onLayout={e => {
          width.current = e.nativeEvent.layout.width || 1;
        }}
      >
        <View
          style={[
            styles.window,
            {
              left: `${left}%`,
              width: `${Math.max(0, endLeft - left)}%`,
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
            },
          ]}
        />
        <View
          style={[styles.handle, { left: `${left}%`, backgroundColor: colors.primary }]}
          {...startPan.panHandlers}
        />
        <View
          style={[styles.handle, { left: `${endLeft}%`, backgroundColor: colors.primary }]}
          {...endPan.panHandlers}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  time: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  track: { height: 36, borderRadius: 6, justifyContent: 'center' },
  window: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderTopWidth: 3,
    borderBottomWidth: 3,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 16,
    marginLeft: -8,
    borderRadius: 3,
  },
});
