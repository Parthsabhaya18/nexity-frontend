import { Pause, Play, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video, { type VideoRef } from 'react-native-video';

export type PreviewMedia = {
  uri: string;
  width: number;
  height: number;
  video: boolean;
};

/** Largest size that shows the whole photo inside the screen (with a small margin). */
export function previewSize(
  photo: { width: number; height: number },
  screenWidth: number,
  screenHeight: number,
) {
  const maxW = screenWidth - 24;
  const maxH = screenHeight * 0.8;
  if (!photo.width || !photo.height) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / photo.width, maxH / photo.height);
  return {
    width: Math.round(photo.width * scale),
    height: Math.round(photo.height * scale),
  };
}

/** False on an app binary built before the native video player was added. */
const hasVideoPlayer = () => UIManager.hasViewManagerConfig('RCTVideo');

/** `m:ss`, or `h:mm:ss` from an hour up. */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Full-size look at one gallery item; videos play with pause and a seekable progress bar. */
export function MediaPreview({
  media,
  onClose,
}: {
  media: PreviewMedia | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = media
    ? previewSize(media, width, height - insets.top - insets.bottom - (media.video ? 72 : 0))
    : null;

  return (
    <Modal
      visible={Boolean(media)}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {media && size ? (
          media.video ? (
            hasVideoPlayer() ? (
              <VideoPreview uri={media.uri} size={size} />
            ) : (
              <View style={styles.videoWrap}>
                <Image
                  source={{ uri: media.uri }}
                  style={[styles.media, size]}
                  resizeMode="contain"
                />
                <Text style={styles.unavailable}>
                  Video playback needs the latest app build.
                </Text>
              </View>
            )
          ) : (
            <Image
              source={{ uri: media.uri }}
              style={[styles.media, size]}
              resizeMode="contain"
            />
          )
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
          style={[styles.close, { top: insets.top + 10 }]}
        >
          <X size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

function VideoPreview({
  uri,
  size,
}: {
  uri: string;
  size: { width: number; height: number };
}) {
  const ref = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    setPaused(false);
    setTime(0);
    setDuration(0);
  }, [uri]);

  const progress = duration ? Math.min(1, time / duration) : 0;

  return (
    <View style={styles.videoWrap}>
      <Video
        ref={ref}
        source={{ uri }}
        style={[styles.media, size]}
        resizeMode="contain"
        paused={paused}
        progressUpdateInterval={100}
        onLoad={e => setDuration(e.duration)}
        onProgress={e => setTime(e.currentTime)}
        onEnd={() => {
          setPaused(true);
          setTime(duration);
        }}
      />
      <View style={[styles.controls, { width: size.width }]}>
        <Pressable
          onPress={() => {
            if (paused && duration && time >= duration - 0.05) {
              ref.current?.seek(0);
              setTime(0);
            }
            setPaused(p => !p);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Play' : 'Pause'}
          style={styles.playButton}
        >
          {paused ? (
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </Pressable>
        <Pressable
          style={styles.track}
          onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
          onPress={e => {
            if (!duration || !barWidth) return;
            const to = (e.nativeEvent.locationX / barWidth) * duration;
            ref.current?.seek(to);
            setTime(to);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Video progress"
        >
          <View style={styles.trackBase}>
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <Text style={styles.time} allowFontScaling={false}>
          {formatDuration(time)} / {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  media: { borderRadius: 12, overflow: 'hidden' },
  close: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  videoWrap: { alignItems: 'center' },
  unavailable: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '600', marginTop: 16 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  track: { flex: 1, height: 28, justifyContent: 'center' },
  trackBase: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackFill: { height: 4, backgroundColor: '#FFFFFF' },
  time: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600', minWidth: 76, textAlign: 'right' },
});
