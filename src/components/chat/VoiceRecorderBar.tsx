import { Mic, SendHorizontal, Square, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';

import { deleteFile, fileSize } from '@/features/media/localFiles';
import { VOICE_MAX_MS } from '@/features/media/mediaRules';
import type { LocalMedia } from '@/features/media/pickMedia';
import { SOUND_UNAVAILABLE, voicePlayer, voiceRecorder } from '@/services/media/sound';
import { useAppTheme } from '@/theme';

const BAR_COUNT = 30;
const MIN_MS = 500;
const QUIET = 0.12;
/** Metering is in dBFS (-160…0); speech mostly sits between -50 and -10. */
const FLOOR_DB = -50;

/** Small mono AAC: plenty for speech and quick to upload. */
const AUDIO_SET = {
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSamplingRate: 44100,
  AudioChannels: 1,
  AudioEncodingBitRate: 64000,
};

type Props = {
  onCancel: () => void;
  onSend: (file: LocalMedia) => void;
  onError: (message: string) => void;
};

const quiet = () => Array.from({ length: BAR_COUNT }, () => QUIET);

const levelOf = (db: number | undefined) =>
  db === undefined
    ? QUIET
    : Math.max(QUIET, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB));

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Instagram-style voice note recorder; stops by itself at one minute. */
export function VoiceRecorderBar({ onCancel, onSend, onError }: Props) {
  const { colors } = useAppTheme();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(quiet);
  const [sending, setSending] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const uri = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const finished = useRef(false);
  const callbacks = useRef({ onError, onCancel });
  callbacks.current = { onError, onCancel };

  useEffect(() => {
    const recorder = voiceRecorder();
    if (!recorder) {
      callbacks.current.onError(SOUND_UNAVAILABLE);
      callbacks.current.onCancel();
      return;
    }
    let alive = true;
    voicePlayer()?.stopPlayer().catch(() => {});
    recorder.setSubscriptionDuration(0.1);
    recorder.addRecordBackListener(e => {
      if (!alive) return;
      const ms = Math.min(VOICE_MAX_MS, e.currentPosition);
      elapsedRef.current = ms;
      setElapsed(ms);
      setLevels(prev => [...prev.slice(1), levelOf(e.currentMetering)]);
      if (ms >= VOICE_MAX_MS) {
        recorder.pauseRecorder().catch(() => {});
        setRecording(false);
      }
    });
    recorder
      .startRecorder(undefined, AUDIO_SET, true)
      .then(path => {
        uri.current = path;
        if (alive) setRecording(true);
        else recorder.stopRecorder().then(() => deleteFile(path)).catch(() => {});
      })
      .catch(() => {
        if (!alive) return;
        callbacks.current.onError("Couldn't start recording. Try again.");
        callbacks.current.onCancel();
      });
    return () => {
      alive = false;
      recorder.removeRecordBackListener();
      if (finished.current) return;
      const path = uri.current;
      recorder
        .stopRecorder()
        .then(() => deleteFile(path ?? undefined))
        .catch(() => {});
    };
  }, []);

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

  const togglePause = () => {
    const recorder = voiceRecorder();
    if (!recorder || !uri.current) return;
    if (recording) {
      recorder.pauseRecorder().catch(() => {});
      setRecording(false);
    } else if (elapsedRef.current < VOICE_MAX_MS) {
      recorder.resumeRecorder().catch(() => {});
      setRecording(true);
    }
  };

  const send = async () => {
    const recorder = voiceRecorder();
    if (!recorder || sending) return;
    setSending(true);
    finished.current = true;
    try {
      const path = await recorder.stopRecorder();
      const file = path.startsWith('file://') || path.startsWith('/') ? path : uri.current;
      if (!file) throw new Error('No recording');
      onSend({
        uri: file,
        kind: 'audio',
        contentType: 'audio/mp4',
        fileName: 'voice.m4a',
        bytes: await fileSize(file),
        durationMs: Math.max(MIN_MS, elapsedRef.current),
      });
    } catch {
      onError("Couldn't save the recording. Try again.");
      onCancel();
    }
  };

  const ready = elapsed >= MIN_MS && !sending;

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
          onPress={togglePause}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Pause recording' : 'Resume recording'}
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
        onPress={send}
        disabled={!ready}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: colors.button },
          !ready && styles.disabled,
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
