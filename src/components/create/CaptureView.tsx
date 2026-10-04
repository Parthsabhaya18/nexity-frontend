import {
  CameraRoll,
  type PhotoIdentifier,
} from '@react-native-camera-roll/camera-roll';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  SwitchCamera,
  Upload,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  type Recorder,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';

import { formatDuration, maxDurationMs } from '@/features/media/mediaRules';
import {
  type LocalMedia,
  MediaError,
  pickFromLibrary,
} from '@/features/media/pickMedia';
import {
  openPermissionSettings,
  requestAccess,
} from '@/features/media/permissionPrompt';
import { radius, spacing } from '@/theme';

export type CaptureMode = 'post' | 'story' | 'reel';

type Props = {
  mode: CaptureMode;
  onClose: () => void;
  /** One item for a story or reel; one or more photos for a post. */
  onDone: (media: LocalMedia[]) => void;
  /** Post ↔ Reel tabs under the shutter. Stories have no tabs. */
  onSwitchMode?: (mode: 'post' | 'reel') => void;
};

const MAX_POST_PHOTOS = 10;
const THUMB = 56;
const WHITE = '#FFFFFF';
const DIM = 'rgba(255, 255, 255, 0.72)';
const GLASS = 'rgba(255, 255, 255, 0.14)';

function toMedia(node: PhotoIdentifier['node']): LocalMedia {
  const image = node.image;
  const video = node.type === 'video' || node.type === 'pairedVideo';
  return {
    uri: image.uri,
    kind: video ? 'video' : 'image',
    contentType: video ? 'video/mp4' : 'image/jpeg',
    fileName: image.filename ?? (video ? 'video.mp4' : 'photo.jpg'),
    bytes: image.fileSize ?? 0,
    width: image.width,
    height: image.height,
    durationMs:
      video && image.playableDuration
        ? Math.round(image.playableDuration * 1000)
        : undefined,
  };
}

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
 * The camera that opens first for a story, post or reel, like the prototype.
 * The phone asks for camera (and microphone for video) the moment it opens.
 */
export function CaptureView({ mode, onClose, onDone, onSwitchMode }: Props) {
  const story = mode === 'story';
  const reel = mode === 'reel';
  const vertical = story || reel;
  const maxMs = maxDurationMs(mode) ?? 60_000;

  const camera = useCameraPermission();
  const mic = useMicrophonePermission();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(facing);
  const [flash, setFlash] = useState(false);
  const [asked, setAsked] = useState(false);
  const [requesting, setRequesting] = useState(true);
  const [photos, setPhotos] = useState<PhotoIdentifier[]>([]);
  const [picks, setPicks] = useState<LocalMedia[]>([]);
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
  const outputs = vertical ? [photoOutput, videoOutput] : [photoOutput];

  const loadRecent = useCallback(async () => {
    if ((await requestAccess('photos')) !== 'granted') return;
    try {
      const page = await CameraRoll.getPhotos({
        first: 30,
        assetType: reel ? 'Videos' : story ? 'All' : 'Photos',
        include: ['filename', 'fileSize', 'imageSize', 'playableDuration'],
      });
      setPhotos(page.edges);
    } catch {
      setPhotos([]);
    }
  }, [reel, story]);

  // Ask in the order the screen needs them: camera, then microphone for
  // video, then photos for the strip. Each is the phone's own dialog.
  useEffect(() => {
    if (asked) return;
    setAsked(true);
    (async () => {
      if (!camera.hasPermission && camera.canRequestPermission) {
        await camera.requestPermission().catch(() => false);
      }
      setRequesting(false);
      if (vertical && !mic.hasPermission && mic.canRequestPermission) {
        await mic.requestPermission();
      }
      await loadRecent();
    })().catch(() => {});
  }, [asked, camera, mic, vertical, loadRecent]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') loadRecent().catch(() => {});
    });
    return () => sub.remove();
  }, [loadRecent]);

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
      const shot: LocalMedia = {
        uri,
        kind: 'image',
        contentType: 'image/jpeg',
        fileName: `photo-${Date.now()}.jpg`,
        bytes: 0,
        width: size.width,
        height: size.height,
      };
      onDone(story ? [shot] : [...picks, shot].slice(0, MAX_POST_PHOTOS));
    } catch {
      Alert.alert("Couldn't take the photo", 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!ready || busy || recording || !vertical) return;
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
    try {
      const items = await pickFromLibrary(mode, {
        kind: reel ? 'video' : story ? undefined : 'image',
        limit: vertical ? 1 : MAX_POST_PHOTOS,
        allowLong: reel,
      });
      if (items.length) onDone(items);
    } catch (err) {
      Alert.alert(
        "Couldn't open photos",
        err instanceof MediaError ? err.message : 'Please try again.',
      );
    }
  };

  const tapThumb = (media: LocalMedia) => {
    if (vertical) {
      onDone([media]);
      return;
    }
    setPicks(current => {
      if (current.some(p => p.uri === media.uri)) {
        return current.filter(p => p.uri !== media.uri);
      }
      if (current.length >= MAX_POST_PHOTOS) return current;
      return [...current, media];
    });
  };

  const viewport = () => {
    if (ready) {
      return (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={outputs}
          isActive={focused && appActive}
          torchMode={recording && flash && canFlash ? 'on' : 'off'}
          enableNativeZoomGesture
          enableNativeTapToFocusGesture
          onError={() => {}}
        />
      );
    }
    if (camera.hasPermission && !device) {
      return (
        <CamState
          title="No camera found"
          text="We couldn't find a camera on this device. Choose from your gallery instead."
        />
      );
    }
    if (requesting) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={WHITE} />
          <Text style={styles.stateTitle}>Opening camera…</Text>
        </View>
      );
    }
    const blocked = !camera.canRequestPermission;
    return (
      <CamState
        title="Camera access is off"
        text={
          blocked
            ? 'Camera is turned off for Nexity. Turn it on in Settings, or choose from your gallery.'
            : 'Allow camera access to take photos in Nexity, or choose from your gallery.'
        }
        action={
          blocked ? (
            <StateButton
              icon={<Settings size={18} color="#0F172A" />}
              label="Open Settings"
              onPress={() => openPermissionSettings('camera').catch(() => {})}
            />
          ) : (
            <StateButton
              icon={<RefreshCw size={18} color="#0F172A" />}
              label="Try again"
              onPress={() => camera.requestPermission().catch(() => {})}
            />
          )
        }
      />
    );
  };

  const title = story ? 'Your story' : reel ? 'New reel' : 'New post';
  const tip = recording
    ? `Recording · ${formatDuration(elapsed)} / ${formatDuration(maxMs)}`
    : reel
    ? `Tap or hold to record (up to ${formatDuration(maxMs)})`
    : story
    ? `Tap for photo · hold for video (up to ${formatDuration(maxMs)})`
    : picks.length
    ? `Tap Next, or keep selecting up to ${MAX_POST_PHOTOS} photos`
    : 'Tap photos to select more than one, or take a photo';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <RoundButton label="Close camera" onPress={onClose}>
          <X size={24} color={WHITE} />
        </RoundButton>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <RoundButton
          label={flash ? 'Flash on' : 'Flash off'}
          onPress={() => setFlash(v => !v)}
          disabled={!ready || !canFlash}
          active={flash}
        >
          {flash ? (
            <Zap size={22} color={WHITE} />
          ) : (
            <ZapOff size={22} color={WHITE} />
          )}
        </RoundButton>
      </View>

      <View style={styles.view}>
        <View
          style={[styles.frame, vertical ? styles.vertical : styles.square]}
        >
          {viewport()}
          {recording ? (
            <View style={styles.rec}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{formatDuration(elapsed)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.bottom}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          accessibilityLabel="Recent photos"
        >
          <Pressable
            onPress={openGallery}
            accessibilityRole="button"
            accessibilityLabel={
              vertical ? 'Upload from device' : 'Upload photos'
            }
            style={[styles.thumb, styles.upload]}
          >
            <Upload size={20} color={WHITE} />
          </Pressable>
          {photos.map((edge, i) => {
            const media = toMedia(edge.node);
            const n = vertical ? -1 : picks.findIndex(p => p.uri === media.uri);
            return (
              <Pressable
                key={media.uri + i}
                onPress={() => tapThumb(media)}
                accessibilityRole="button"
                accessibilityState={{ selected: n >= 0 }}
                accessibilityLabel={
                  n >= 0 ? `Photo ${n + 1} selected` : 'Select this photo'
                }
                style={[styles.thumb, n >= 0 && styles.picked]}
              >
                <Image source={{ uri: media.uri }} style={styles.fill} />
                {n >= 0 ? (
                  <View style={styles.num}>
                    <Text style={styles.numText}>{n + 1}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.controls}>
          <RoundButton label="Choose from gallery" onPress={openGallery} big>
            <ImageIcon size={24} color={WHITE} />
          </RoundButton>
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
              if (!vertical) return;
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
                (recording || reel) && styles.shutterRec,
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

        {!vertical && picks.length ? (
          <Pressable
            onPress={() => onDone(picks)}
            accessibilityRole="button"
            style={styles.next}
          >
            <Text style={styles.nextText}>Next · {picks.length}</Text>
          </Pressable>
        ) : null}

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
        <Text style={styles.tip}>{tip}</Text>
      </View>
    </SafeAreaView>
  );
}

function CamState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <CameraIcon size={30} color={WHITE} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {action}
    </View>
  );
}

function StateButton({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.stateBtn, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.stateBtnText}>{label}</Text>
    </Pressable>
  );
}

function RoundButton({
  label,
  onPress,
  disabled,
  active,
  big,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
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
      accessibilityState={{ disabled, selected: active }}
      style={({ pressed }) => [
        styles.round,
        big && styles.roundBig,
        active && styles.roundOn,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  title: { color: WHITE, fontSize: 16, fontWeight: '800' },
  view: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#111111',
  },
  vertical: { flex: 1 },
  square: { aspectRatio: 1 },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  stateTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: DIM,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stateBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: WHITE,
  },
  stateBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  rec: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recText: { color: WHITE, fontWeight: '700', fontSize: 13 },
  bottom: { paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: 10 },
  strip: { gap: 8, paddingHorizontal: spacing.md },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  upload: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  picked: { borderColor: WHITE },
  fill: { width: '100%', height: '100%' },
  num: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  numText: { color: '#0F172A', fontSize: 11, fontWeight: '800' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBig: { width: 48, height: 48, borderRadius: 24, backgroundColor: GLASS },
  roundOn: { backgroundColor: 'rgba(255, 255, 255, 0.28)' },
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
  next: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  nextText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  modes: { flexDirection: 'row', alignSelf: 'center', gap: 6 },
  mode: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  modeOn: { backgroundColor: GLASS },
  modeText: { color: DIM, fontWeight: '700', fontSize: 14 },
  modeTextOn: { color: WHITE },
  tip: {
    color: DIM,
    fontSize: 12.5,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
