import { useIsFocused } from '@react-navigation/native';
import {
  Image as ImageIcon,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import {
  Camera,
  type Recorder,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';

import { GalleryPicker } from '@/components/create/GalleryPicker';
import {
  formatDuration,
  type MediaKind,
  maxDurationMs,
} from '@/features/media/mediaRules';
import {
  requestAccess,
  showPermissionPrompt,
} from '@/features/media/permissionPrompt';
import { type LocalMedia, MediaError, validateMedia } from '@/features/media/pickMedia';
import { radius, spacing } from '@/theme';

export type CaptureMode = 'post' | 'story' | 'reel';

type Props = {
  mode: CaptureMode;
  onClose: () => void;
  /** What was shot or chosen. Posts can arrive with several items. */
  onDone: (media: LocalMedia[]) => void;
  /** Post ↔ Reel tabs under the shutter. Stories have no tabs. */
  onSwitchMode?: (mode: 'post' | 'reel') => void;
  /** Items already in the post, so the gallery counts them against the limit. */
  alreadySelected?: number;
};

// Controls sit on top of a live camera, so they are always white on dark glass.
const WHITE = '#FFFFFF';
const DIM = 'rgba(255, 255, 255, 0.78)';
const GLASS = 'rgba(0, 0, 0, 0.38)';

const fileUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', s =>
      setActive(s === 'active'),
    );
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Full-screen camera for a post, story or reel. The phone's own permission
 * dialogs appear as soon as the camera opens. The gallery icon opens the
 * gallery grid; nothing else sits on the picture.
 */
export function CaptureView({
  mode,
  onClose,
  onDone,
  onSwitchMode,
  alreadySelected = 0,
}: Props) {
  const story = mode === 'story';
  const reel = mode === 'reel';
  const canRecord = story || reel;
  const maxMs = maxDurationMs(mode) ?? 120_000;

  const camera = useCameraPermission();
  const mic = useMicrophonePermission();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const device = useCameraDevice(facing);
  const [flash, setFlash] = useState(false);
  const [asked, setAsked] = useState(false);
  const [requesting, setRequesting] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<Recorder | null>(null);
  const startedAt = useRef(0);
  const held = useRef(false);
  const focused = useIsFocused();
  const appActive = useAppActive();

  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({ enableAudio: mic.hasPermission });
  const outputs = canRecord ? [photoOutput, videoOutput] : [photoOutput];

  // The phone's dialogs, in the order the screen needs them.
  useEffect(() => {
    if (asked) return;
    setAsked(true);
    (async () => {
      if (!camera.hasPermission && camera.canRequestPermission) {
        await camera.requestPermission().catch(() => false);
      }
      setRequesting(false);
      if (canRecord && !mic.hasPermission && mic.canRequestPermission) {
        await mic.requestPermission().catch(() => false);
      }
    })().catch(() => setRequesting(false));
  }, [asked, camera, mic, canRecord]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () => setElapsed(Date.now() - startedAt.current),
      250,
    );
    return () => clearInterval(timer);
  }, [recording]);

  const ready = camera.hasPermission && !!device;
  const canFlash = facing === 'back' && !!device?.hasFlash;

  const askAgain = async () => {
    if (camera.canRequestPermission) {
      await camera.requestPermission().catch(() => false);
      return;
    }
    // Android no longer shows its dialog; Settings is the only way left.
    showPermissionPrompt('camera');
  };

  const takePhoto = async () => {
    if (!ready || busy || recording) return;
    setBusy(true);
    try {
      const photo = await photoOutput.capturePhoto(
        { flashMode: flash && canFlash ? 'on' : 'off' },
        {},
      );
      const path = await photo.saveToTemporaryFileAsync();
      const fallback = { width: photo.width, height: photo.height };
      photo.dispose();
      const uri = fileUri(path);
      const size = await Image.getSize(uri).catch(() => fallback);
      onDone([
        {
          uri,
          kind: 'image',
          contentType: 'image/jpeg',
          fileName: `photo-${Date.now()}.jpg`,
          bytes: 0,
          width: size.width,
          height: size.height,
        },
      ]);
    } catch {
      Alert.alert("Couldn't take the photo", 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!ready || busy || recording || !canRecord) return;
    try {
      const rec = await videoOutput.createRecorder({
        maxDuration: maxMs / 1000,
      });
      recorder.current = rec;
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      await rec.startRecording(
        path => {
          const durationMs = Date.now() - startedAt.current;
          recorder.current = null;
          setRecording(false);
          if (durationMs < 1000) return;
          onDone([
            {
              uri: fileUri(path),
              kind: 'video',
              contentType: 'video/mp4',
              fileName: `video-${Date.now()}.mp4`,
              bytes: 0,
              durationMs,
            },
          ]);
        },
        () => {
          recorder.current = null;
          setRecording(false);
          Alert.alert("Couldn't record", 'Please try again.');
        },
      );
    } catch {
      recorder.current = null;
      setRecording(false);
    }
  };

  const stopRecording = () => {
    recorder.current?.stopRecording().catch(() => {});
  };

  const openGallery = async () => {
    const access = await requestAccess('photos');
    if (access === 'blocked') {
      showPermissionPrompt('photos');
      return;
    }
    if (access === 'granted') setGalleryOpen(true);
  };

  const picked = (items: LocalMedia[]) => {
    try {
      items.forEach(m => validateMedia(m, mode));
    } catch (err) {
      Alert.alert(
        "Couldn't use that",
        err instanceof MediaError ? err.message : 'Please try again.',
      );
      return;
    }
    setGalleryOpen(false);
    setLastShot(items[0]?.uri ?? null);
    onDone(items);
  };

  const galleryKind: MediaKind | undefined = reel ? 'video' : undefined;
  const tip = recording
    ? `${formatDuration(elapsed)} / ${formatDuration(maxMs)}`
    : reel
    ? 'Tap to record'
    : story
    ? 'Tap for photo · hold for video'
    : null;

  return (
    <View style={styles.root}>
      {ready ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={outputs}
          isActive={focused && appActive && !galleryOpen}
          torchMode={recording && flash && canFlash ? 'on' : 'off'}
          enableNativeZoomGesture
          enableNativeTapToFocusGesture
          onError={() => {}}
        />
      ) : (
        <Pressable
          style={styles.state}
          onPress={camera.hasPermission ? undefined : askAgain}
          accessibilityRole="button"
          accessibilityLabel="Allow camera"
        >
          {requesting ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.stateText}>
              {camera.hasPermission
                ? 'No camera found on this device.'
                : 'Camera permission is needed. Tap to allow.'}
            </Text>
          )}
        </Pressable>
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <RoundButton label="Close camera" onPress={onClose}>
            <X size={24} color={WHITE} />
          </RoundButton>
          {recording ? (
            <View style={styles.rec}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{formatDuration(elapsed)}</Text>
            </View>
          ) : null}
          <RoundButton
            label={flash ? 'Flash on' : 'Flash off'}
            onPress={() => setFlash(v => !v)}
            disabled={!ready || !canFlash}
          >
            {flash ? (
              <Zap size={22} color={WHITE} />
            ) : (
              <ZapOff size={22} color={WHITE} />
            )}
          </RoundButton>
        </View>

        <View style={styles.spacer} pointerEvents="none" />

        <View style={styles.bottom} pointerEvents="box-none">
          {tip ? <Text style={styles.tip}>{tip}</Text> : null}
          <View style={styles.controls}>
            <Pressable
              onPress={openGallery}
              accessibilityRole="button"
              accessibilityLabel="Choose from gallery"
              style={styles.gallery}
            >
              {lastShot ? (
                <Image source={{ uri: lastShot }} style={styles.galleryImg} />
              ) : (
                <ImageIcon size={24} color={WHITE} />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                if (reel) {
                  if (recording) stopRecording();
                  else startRecording().catch(() => {});
                  return;
                }
                takePhoto().catch(() => {});
              }}
              onLongPress={() => {
                if (!story) return;
                held.current = true;
                startRecording().catch(() => {});
              }}
              onPressOut={() => {
                if (held.current) {
                  held.current = false;
                  stopRecording();
                }
              }}
              delayLongPress={250}
              disabled={!ready || busy}
              accessibilityRole="button"
              accessibilityLabel={
                reel
                  ? recording
                    ? 'Stop recording'
                    : 'Record'
                  : story
                  ? 'Take photo, or hold to record video'
                  : 'Take photo'
              }
              style={[styles.shutter, !ready && styles.disabled]}
            >
              <View
                style={[
                  styles.shutterInner,
                  reel && styles.shutterRec,
                  recording && styles.shutterRecOn,
                ]}
              />
            </Pressable>
            <RoundButton
              label="Switch camera"
              onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))}
              disabled={!ready || recording}
              big
            >
              <SwitchCamera size={24} color={WHITE} />
            </RoundButton>
          </View>

          {story || !onSwitchMode ? null : (
            <View style={styles.modes} accessibilityRole="tablist">
              {(['post', 'reel'] as const).map(m => {
                const active = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => (active ? null : onSwitchMode(m))}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.mode, active && styles.modeOn]}
                  >
                    <Text style={[styles.modeText, active && styles.modeTextOn]}>
                      {m === 'post' ? 'Post' : 'Reel'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </SafeAreaView>

      <GalleryPicker
        visible={galleryOpen}
        purpose={mode}
        kind={galleryKind}
        multiple={mode === 'post'}
        alreadySelected={alreadySelected}
        onClose={() => setGalleryOpen(false)}
        onPick={picked}
      />
    </View>
  );
}

function RoundButton({
  label,
  onPress,
  disabled,
  big,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.round,
        big && styles.roundBig,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  overlay: { ...StyleSheet.absoluteFill },
  state: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  stateText: { color: DIM, fontSize: 15, textAlign: 'center' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  spacer: { flex: 1 },
  bottom: { paddingBottom: spacing.sm, gap: 12 },
  rec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: GLASS,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recText: { color: WHITE, fontWeight: '700', fontSize: 13 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  gallery: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  galleryImg: { width: '100%', height: '100%' },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  roundBig: { width: 48, height: 48, borderRadius: 24 },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: WHITE,
  },
  shutterRec: { backgroundColor: '#EF4444' },
  shutterRecOn: { width: 30, height: 30, borderRadius: 8 },
  modes: { flexDirection: 'row', alignSelf: 'center', gap: 6 },
  mode: {
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  modeOn: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  modeText: { color: DIM, fontWeight: '700', fontSize: 14 },
  modeTextOn: { color: WHITE },
  tip: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
