import { Mic, SendHorizontal, Square, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

const BAR_COUNT = 30;
const TICK_MS = 110;
export const VOICE_MAX_MS = 60_000;

type Props = {
  onCancel: () => void;
  onSend: (durationMs: number) => void;
};

const quiet = () => Array.from({ length: BAR_COUNT }, () => 0.12);

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * Voice note recorder (Instagram-style). UI only for now: nothing is captured or
 * uploaded until the S3 media pipeline is ready.
 */
export function VoiceRecorderBar({ onCancel, onSend }: Props) {
  const { colors } = useAppTheme();
  const [recording, setRecording] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(quiet);
  const startedAt = useRef(Date.now());
  const banked = useRef(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) return;
    startedAt.current = Date.now();
    const id = setInterval(() => {
      const total = banked.current + Date.now() - startedAt.current;
      if (total >= VOICE_MAX_MS) {
        banked.current = VOICE_MAX_MS;
        setElapsed(VOICE_MAX_MS);
        setRecording(false);
        return;
      }
      setElapsed(total);
      // Speech-like envelope: mostly mid levels with occasional peaks and pauses.
      const r = Math.random();
      const level = r < 0.12 ? 0.12 : r > 0.9 ? 0.95 : 0.3 + Math.random() * 0.5;
      setLevels(prev => [...prev.slice(1), level]);
    }, TICK_MS);
    return () => {
      clearInterval(id);
      banked.current = Math.min(
        VOICE_MAX_MS,
        banked.current + Date.now() - startedAt.current,
      );
    };
  }, [recording]);

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCancel}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Discard voice message"
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: colors.dangerSoft },
          pressed && styles.pressed,
        ]}
      >
        <Trash2 size={20} color={colors.danger} />
      </Pressable>

      <View style={[styles.pill, { backgroundColor: colors.button }]}>
        <Pressable
          onPress={() => setRecording(r => !r)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Resume recording'}
          style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
        >
          {recording ? (
            <Square size={13} color={colors.button} fill={colors.button} />
          ) : (
            <Mic size={16} color={colors.button} />
          )}
        </Pressable>
        <View
          style={[styles.wave, !recording && styles.wavePaused]}
          accessibilityElementsHidden
        >
          {levels.map((level, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: 4 + level * 22, backgroundColor: colors.onButton },
              ]}
            />
          ))}
        </View>
        <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
        <Text
          style={[styles.timer, { color: colors.onButton }]}
          accessibilityLabel={`Recorded ${formatDuration(elapsed)}`}
        >
          {formatDuration(elapsed)}
        </Text>
      </View>

      <Pressable
        onPress={() => onSend(elapsed)}
        disabled={elapsed < 500}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: colors.button },
          elapsed < 500 && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <SendHorizontal size={19} color={colors.onButton} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 14,
    gap: 8,
  },
  stop: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  wavePaused: { opacity: 0.6 },
  bar: { width: 2.5, borderRadius: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF4D5E' },
  timer: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 34 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.5 },
});
