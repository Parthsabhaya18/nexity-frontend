import { useRef, useState } from 'react';
import {
  Image,
  type ImageStyle,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';

type Props = {
  uri: string;
  kind: 'image' | 'video';
  /** Videos play only while this is true. */
  active?: boolean;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  /** Play only this window of the file. */
  trimStartMs?: number | null;
  trimEndMs?: number | null;
  /** Author muted the original sound, so viewers cannot turn it on. */
  forceMuted?: boolean;
  /** Softens a photo. Ignored for video. */
  blurRadius?: number;
};

/** Photo, or a looping video that stays muted until tapped. */
export function PlayableMedia({
  uri,
  kind,
  active = true,
  style,
  accessibilityLabel,
  trimStartMs,
  trimEndMs,
  forceMuted = false,
  blurRadius = 0,
}: Props) {
  const [muted, setMuted] = useState(true);
  const video = useRef<VideoRef>(null);
  const startSec = (trimStartMs ?? 0) / 1000;
  const silent = forceMuted || muted;
  if (kind === 'image') {
    return (
      <Image
        source={{ uri }}
        style={[styles.fill, style]}
        resizeMode="cover"
        blurRadius={blurRadius}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
  return (
    <Pressable
      onPress={() => {
        if (!forceMuted) setMuted(m => !m);
      }}
      accessibilityRole="button"
      accessibilityLabel={
        forceMuted
          ? 'Original audio is off'
          : muted
          ? 'Unmute video'
          : 'Mute video'
      }
      style={[styles.fill, style]}
    >
      <Video
        ref={video}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        paused={!active}
        repeat={trimEndMs == null}
        muted={silent || !active}
        onLoad={() => {
          if (trimStartMs) video.current?.seek(startSec);
        }}
        onProgress={event => {
          if (trimEndMs == null) return;
          if (event.currentTime * 1000 >= trimEndMs - 40) {
            video.current?.seek(startSec);
          }
        }}
        onEnd={() => video.current?.seek(startSec)}
      />
      {silent ? <View style={styles.mute} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  mute: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
