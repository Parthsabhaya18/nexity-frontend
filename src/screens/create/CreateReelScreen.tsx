import { usePreventRemove } from '@react-navigation/native';
import {
  ChevronRight,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircleOff,
  Volume2,
  X,
} from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureView } from '@/components/create/CaptureView';
import { GalleryPicker } from '@/components/create/GalleryPicker';
import { TrimBar } from '@/components/create/TrimBar';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { MentionInput } from '@/components/posts/MentionInput';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { formatDuration, maxDurationMs } from '@/features/media/mediaRules';
import { type LocalMedia, MediaError } from '@/features/media/pickMedia';
import {
  isUploadCancelled,
  uploadErrorMessage,
  uploadMedia,
} from '@/features/media/uploadMedia';
import { CAPTION_MAX } from '@/features/posts/caption';
import { focusReel } from '@/features/reels/reelFocus';
import type { ScreenProps } from '@/navigation/types';
import { ApiError } from '@/services/api/client';
import { reelsApi } from '@/services/api/reels';
import { radius, spacing, useAppTheme } from '@/theme';

type Cover = 'start' | 'middle' | 'photo';

/** Full-screen camera or gallery first, then trim, describe and share. */
export function CreateReelScreen({ navigation }: ScreenProps<'CreateReel'>) {
  const { colors } = useAppTheme();
  const maxMs = maxDurationMs('reel') ?? 120_000;
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [coverMode, setCoverMode] = useState<Cover>('start');
  const [coverPhoto, setCoverPhoto] = useState<LocalMedia | null>(null);
  const [coverPicker, setCoverPicker] = useState(false);
  const [places, setPlaces] = useState(false);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const uploadId = useRef('');
  const controller = useRef<AbortController | null>(null);
  const busy = progress !== null;

  usePreventRemove(!!media, ({ data }) => {
    Alert.alert(
      busy ? 'Stop sharing?' : 'Discard this reel?',
      busy ? 'Your reel is still uploading.' : 'Your video and description will be lost.',
      [
        { text: busy ? 'Keep uploading' : 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            controller.current?.abort();
            navigation.dispatch(data.action);
          },
        },
      ],
    );
  });

  const applyClip = (clip: LocalMedia) => {
    const duration = clip.durationMs ?? maxMs;
    uploadId.current = `reel-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setMedia(clip);
    setStartMs(0);
    setEndMs(Math.min(duration, maxMs));
    setCoverMode('start');
    setCoverPhoto(null);
    setAudioMuted(false);
  };

  const share = async () => {
    if (!media || busy) return;
    const duration = media.durationMs ?? endMs;
    const trimmed = startMs > 0 || endMs - startMs < duration - 200;
    if (endMs - startMs > maxMs + 500) {
      Alert.alert('That clip is too long', `A reel can be up to ${formatDuration(maxMs)}.`);
      return;
    }
    if (endMs - startMs < 1000) {
      Alert.alert('That clip is too short', 'A reel has to be at least 1 second.');
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setProgress(0);
    try {
      const withCover = coverMode === 'photo' && !!coverPhoto;
      const videoShare = withCover ? 0.85 : 0.95;
      const asset = await uploadMedia(
        { ...media, durationMs: Math.max(1000, endMs - startMs) },
        'reel',
        { signal: c.signal, onProgress: f => setProgress(f * videoShare) },
      );
      const coverAsset = withCover
        ? await uploadMedia(coverPhoto!, 'post', {
            signal: c.signal,
            onProgress: f => setProgress(videoShare + f * 0.1),
          })
        : null;
      const reel = await reelsApi.create({
        video_media_id: asset.id,
        caption: caption.trim(),
        location_name: location.trim(),
        location_lat: locationLat,
        location_lng: locationLng,
        audio_muted: audioMuted,
        hide_like_count: hideLikes,
        comments_disabled: commentsOff,
        cover_time_ms: Math.round(coverMode === 'middle' ? (startMs + endMs) / 2 : startMs),
        cover_media_id: coverAsset?.id,
        client_upload_id: uploadId.current,
        trim_start_ms: trimmed ? Math.round(startMs) : null,
        trim_end_ms: trimmed ? Math.round(endMs) : null,
      });
      setProgress(1);
      focusReel(reel);
      setMedia(null);
      setTimeout(() => navigation.popTo('Main', { screen: 'Reels' }), 0);
    } catch (err) {
      setProgress(null);
      if (c.signal.aborted || isUploadCancelled(err)) return;
      Alert.alert(
        "Couldn't share reel",
        err instanceof ApiError || err instanceof MediaError
          ? err.message
          : uploadErrorMessage(err),
      );
    }
  };

  if (!media) {
    return (
      <CaptureView
        mode="reel"
        onClose={() => navigation.goBack()}
        onDone={items => {
          if (items[0]) applyClip(items[0]);
        }}
        onSwitchMode={next => {
          if (next === 'post') navigation.replace('CreatePostCrop');
        }}
      />
    );
  }

  const coverChoices: { id: Cover; label: string }[] = [
    { id: 'start', label: 'First frame' },
    { id: 'middle', label: 'Middle' },
    { id: 'photo', label: coverPhoto ? 'Photo ✓' : 'Photo' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar
        title="New reel"
        back
        actions={
          <Pressable
            onPress={share}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.shareBtn}
          >
            <Text style={[styles.shareText, { color: colors.primary }]}>Share</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.previewRow}>
            <View style={styles.preview}>
              {coverMode === 'photo' && coverPhoto ? (
                <Image source={{ uri: coverPhoto.uri }} style={StyleSheet.absoluteFill} />
              ) : (
                <PlayableMedia
                  uri={media.uri}
                  kind="video"
                  active={!busy}
                  trimStartMs={startMs}
                  trimEndMs={endMs}
                  forceMuted={audioMuted}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </View>
          </View>

          {media.durationMs && media.durationMs > 1000 ? (
            <TrimBar
              durationMs={media.durationMs}
              startMs={startMs}
              endMs={endMs || Math.min(media.durationMs, maxMs)}
              maxMs={maxMs}
              onChange={(start, end) => {
                setStartMs(start);
                setEndMs(end);
              }}
            />
          ) : null}

          <View style={[styles.captionBox, { borderColor: colors.border }]}>
            <MentionInput
              value={caption}
              onChange={setCaption}
              placeholder="Write a description… Type @ to mention someone"
              maxLength={CAPTION_MAX}
              accessibilityLabel="Description"
            />
          </View>

          <Text style={[styles.section, { color: colors.textSecondary }]}>Cover</Text>
          <View style={styles.segment}>
            {coverChoices.map(choice => {
              const on = coverMode === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => {
                    if (choice.id === 'photo') setCoverPicker(true);
                    else setCoverMode(choice.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.segmentItem,
                    {
                      backgroundColor: on ? colors.primarySoft : colors.surfaceAlt,
                      borderColor: on ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {choice.id === 'photo' ? (
                    <ImageIcon size={16} color={on ? colors.primary : colors.text} />
                  ) : null}
                  <Text style={[styles.segmentText, { color: on ? colors.primary : colors.text }]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setPlaces(true)}
            accessibilityRole="button"
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <MapPin size={22} color={colors.text} />
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Add location</Text>
              {location ? (
                <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                    {location}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setLocation('');
                      setLocationLat(null);
                      setLocationLng(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove location"
                  >
                    <X size={14} color={colors.text} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          <Text style={[styles.section, { color: colors.textSecondary }]}>Settings</Text>
          <ToggleRow
            icon={<Volume2 size={22} color={colors.text} />}
            title="Original audio"
            subtitle="Viewers hear the sound recorded with the video."
            value={!audioMuted}
            onChange={v => setAudioMuted(!v)}
          />
          <ToggleRow
            icon={<Heart size={22} color={colors.text} />}
            title="Hide like count"
            subtitle="No one, including you, will see the number of likes."
            value={hideLikes}
            onChange={setHideLikes}
          />
          <ToggleRow
            icon={<MessageCircleOff size={22} color={colors.text} />}
            title="Turn off commenting"
            subtitle="You can change this later from the reel's ⋯ menu."
            value={commentsOff}
            onChange={setCommentsOff}
          />

          <Button
            title="Choose another video"
            variant="ghost"
            onPress={() =>
              Alert.alert('Choose another video?', 'This edit will be cleared.', [
                { text: 'Keep editing', style: 'cancel' },
                {
                  text: 'Choose another',
                  style: 'destructive',
                  onPress: () => {
                    setMedia(null);
                    setCaption('');
                    setLocation('');
                    setLocationLat(null);
                    setLocationLng(null);
                  },
                },
              ])
            }
            style={styles.another}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={busy} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.uploadBackdrop}>
          <View style={[styles.uploadCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.uploadTitle, { color: colors.text }]}>
              Sharing your reel… {Math.round((progress ?? 0) * 100)}%
            </Text>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.trackFill,
                  { backgroundColor: colors.primary, width: `${Math.round((progress ?? 0) * 100)}%` },
                ]}
              />
            </View>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                controller.current?.abort();
                setProgress(null);
              }}
              style={styles.cancel}
            />
          </View>
        </View>
      </Modal>

      <GalleryPicker
        visible={coverPicker}
        purpose="post"
        kind="image"
        onClose={() => setCoverPicker(false)}
        onPick={items => {
          setCoverPicker(false);
          if (items[0]) {
            setCoverPhoto(items[0]);
            setCoverMode('photo');
          }
        }}
      />
      <LocationSheet
        visible={places}
        onClose={() => setPlaces(false)}
        onSelect={place => {
          setLocation(place.name);
          setLocationLat(place.latitude);
          setLocationLng(place.longitude);
        }}
      />
    </SafeAreaView>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.toggleRow}>
      {icon}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Toggle value={value} onChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  shareBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  shareText: { fontSize: 16, fontWeight: '800' },
  previewRow: { alignItems: 'center', paddingVertical: spacing.sm },
  preview: {
    height: 400,
    aspectRatio: 9 / 16,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  captionBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: 6,
    marginHorizontal: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  segment: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 13.5, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 15.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 8,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  another: { marginTop: spacing.md, alignSelf: 'center' },
  uploadBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  uploadCard: {
    width: '82%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 14,
  },
  uploadTitle: { fontSize: 16, fontWeight: '700' },
  track: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3 },
  cancel: { minWidth: 140 },
});
