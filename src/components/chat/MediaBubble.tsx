import { Pause, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';

import { useVoicePlayback, voicePlayback } from '@/features/chats/voicePlayback';
import { useAppTheme } from '@/theme';

import { formatDuration, hasVideoPlayer } from './MediaPreview';

const TILE_WIDTH = 240;
const TILE_MAX_HEIGHT = 300;
const WAVE_BARS = 28;

/** Photo or video tile: keeps the file's shape within 240 × 300. */
export function tileSize(width: number | null, height: number | null) {
  if (!width || !height) return { width: TILE_WIDTH, height: TILE_WIDTH * 1.25 };
  const h = Math.min(TILE_MAX_HEIGHT, (TILE_WIDTH * height) / width);
  return { width: Math.round(Math.min(TILE_WIDTH, (h * width) / height)), height: Math.round(h) };
}

type VisualProps = {
  uri: string;
  video: boolean;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** 0–1 while my upload is going; `undefined` once it's sent. */
  progress?: number;
};

/** A sent photo or video; tap opens it full screen (handled by the bubble). */
export function VisualMedia({ uri, video, width, height, durationMs, progress }: VisualProps) {
  const { colors } = useAppTheme();
  const size = tileSize(width, height);
  return (
    <View style={[styles.tile, size, { backgroundColor: colors.surfaceAlt }]}>
      {video && hasVideoPlayer() ? (
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          paused
          muted
          disableFocus
          accessibilityLabel="Video"
        />
      ) : !video ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel="Photo"
        />
      ) : null}
      {video ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
        </View>
      ) : null}
      {video && durationMs ? (
        <Text style={styles.duration} allowFontScaling={false}>
          {formatDuration(durationMs / 1000)}
        </Text>
      ) : null}
      {progress !== undefined ? (
        <View style={styles.uploading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.percent} allowFontScaling={false}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type StackItem = { uri: string; video: boolean };

/** Photo, or the first frame of a video, filling its parent. */
export function Thumb({ item }: { item: StackItem }) {
  if (item.video && hasVideoPlayer()) {
    return (
      <Video
        source={{ uri: item.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        paused
        muted
        disableFocus
      />
    );
  }
  return item.video ? null : (
    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
  );
}

const STACK_TILT = 6;

/**
 * Several photos / videos sent together: the first on top, two more tilted behind it
 * (Instagram's album stack). Tap opens the grid (handled by the bubble).
 */
export function AlbumStack({
  items,
  mine,
  progress,
  small,
}: {
  items: readonly StackItem[];
  mine: boolean;
  progress?: number;
  /** Quote thumbnail size. */
  small?: boolean;
}) {
  const { colors } = useAppTheme();
  const card = small ? styles.stackCardSmall : styles.stackCard;
  const behind = items.slice(1, 3);
  const tilt = (i: number) => {
    const side = (i % 2 === 0) === mine ? -1 : 1;
    return `${side * STACK_TILT * (i + 1)}deg`;
  };
  const front = items[0];
  return (
    <View style={small ? styles.stackSmall : styles.stack}>
      {behind
        .map((item, i) => (
          <View
            key={i}
            style={[
              styles.stackLayer,
              card,
              { backgroundColor: colors.surfaceAlt, transform: [{ rotate: tilt(i) }] },
            ]}
          >
            <Thumb item={item} />
          </View>
        ))
        .reverse()}
      {front ? (
        <View style={[styles.stackLayer, card, { backgroundColor: colors.surfaceAlt }]}>
          <Thumb item={front} />
          {front.video ? (
            <View style={[styles.playBadge, small && styles.playBadgeSmall]} pointerEvents="none">
              <Play size={small ? 14 : 22} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
          {progress !== undefined ? (
            <View style={styles.uploading} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.percent} allowFontScaling={false}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** One photo / video in a quote, faded like the quoted text. */
export function QuoteThumb({ item }: { item: StackItem }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.quoteThumb, { backgroundColor: colors.surfaceAlt }]}>
      <Thumb item={item} />
      {item.video ? (
        <View style={[styles.playBadge, styles.playBadgeSmall]} pointerEvents="none">
          <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

/** Same bar heights every time for a given message, so the waveform doesn't jump. */
function waveFor(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n = (n * 31 + seed.charCodeAt(i)) % 100_003;
  return Array.from({ length: WAVE_BARS }, (_, i) => {
    const x = Math.sin((n + 1) * (i + 1) * 12.9898) * 43758.5453;
    return 0.25 + (x - Math.floor(x)) * 0.75;
  });
}

type VoiceProps = {
  messageId: string;
  seed: string;
  url: string;
  durationMs: number | null;
  mine: boolean;
  /** 0–1 while my upload is going; playing waits until it's sent. */
  progress?: number;
  onError: (message: string) => void;
};

export function VoiceBody({
  messageId,
  seed,
  url,
  durationMs,
  mine,
  progress,
  onError,
}: VoiceProps) {
  const { colors } = useAppTheme();
  const playback = useVoicePlayback(messageId);
  const wave = useMemo(() => waveFor(seed), [seed]);
  const ink = mine ? colors.onButton : colors.text;
  const total = playback.durationMs || durationMs || 0;
  const played = total ? Math.min(1, playback.positionMs / total) : 0;
  const uploading = progress !== undefined;
  const shown = playback.playing || playback.positionMs ? playback.positionMs : total;

  return (
    <View style={styles.voice}>
      <Pressable
        onPress={() => voicePlayback.toggle(messageId, url, onError)}
        disabled={uploading}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={playback.playing ? 'Pause voice message' : 'Play voice message'}
        style={[
          styles.voiceButton,
          mine ? styles.voiceButtonMine : { backgroundColor: colors.surfaceAlt },
        ]}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={ink} />
        ) : playback.playing ? (
          <Pause size={16} color={ink} fill={ink} />
        ) : (
          <Play size={16} color={ink} fill={ink} />
        )}
      </Pressable>
      <View style={styles.wave} accessibilityElementsHidden>
        {wave.map((level, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              (i + 0.5) / WAVE_BARS > played && styles.waveBarDim,
              { height: 4 + level * 20, backgroundColor: ink },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.voiceTime, { color: ink }]} allowFontScaling={false}>
        {uploading ? `${Math.round(progress * 100)}%` : formatDuration(shown / 1000)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 16, overflow: 'hidden' },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    marginTop: -24,
    marginLeft: -24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  duration: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  uploading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  percent: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  stack: { width: 210, height: 260, alignItems: 'center', justifyContent: 'center' },
  stackSmall: { width: 140, height: 170, alignItems: 'center', justifyContent: 'center' },
  stackLayer: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  stackCard: { width: 176, height: 230, borderRadius: 16 },
  stackCardSmall: { width: 110, height: 144, borderRadius: 12 },
  playBadgeSmall: { width: 28, height: 28, marginTop: -14, marginLeft: -14, borderRadius: 14 },
  quoteThumb: { width: 90, height: 120, borderRadius: 14, overflow: 'hidden' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 220 },
  voiceButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    flex: 1,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceButtonMine: { backgroundColor: 'rgba(255,255,255,0.22)' },
  waveBar: { width: 2.5, borderRadius: 2 },
  waveBarDim: { opacity: 0.45 },
  voiceTime: { fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 34 },
});
