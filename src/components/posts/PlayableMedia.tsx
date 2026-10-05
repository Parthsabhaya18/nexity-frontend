import { Volume2, VolumeX } from 'lucide-react-native';
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
  resizeMode?: 'cover' | 'contain';
};

/**
 * Photo, or a looping video that starts muted. Taps on the picture bubble up
 * to the parent (double-tap to like); the speaker button toggles the sound.
 */
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
  resizeMode = 'cover',
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
        resizeMode={resizeMode}
        blurRadius={blurRadius}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
  return (
    <View style={[styles.fill, style]}>
      <Video
        ref={video}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
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
      {forceMuted ? null : (
        <Pressable
          onPress={() => setMuted(m => !m)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          style={styles.sound}
        >
          {muted ? (
            <VolumeX size={16} color="#FFFFFF" />
          ) : (
            <Volume2 size={16} color="#FFFFFF" />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  sound: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
