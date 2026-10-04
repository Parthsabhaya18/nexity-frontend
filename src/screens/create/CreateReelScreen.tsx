import { usePreventRemove } from '@react-navigation/native';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureView } from '@/components/create/CaptureView';
import { TrimBar } from '@/components/create/TrimBar';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { MusicSheet } from '@/components/posts/MusicSheet';
import { TagPeopleSheet } from '@/components/posts/TagPeopleSheet';
import { LookStrip, LookTint } from '@/components/media/LookStrip';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import type { LocalMedia } from '@/features/media/pickMedia';
import { maxDurationMs } from '@/features/media/mediaRules';
import { MediaError, pickFromLibrary } from '@/features/media/pickMedia';
import { useSubmitLock } from '@/features/auth/useSubmitLock';
import { uploadMedia } from '@/features/media/uploadMedia';
import { CAPTION_MAX } from '@/features/posts/caption';
import { ApiError } from '@/services/api/client';
import { reelsApi } from '@/services/api/reels';
import type { ScreenProps } from '@/navigation/types';
import { spacing, useAppTheme } from '@/theme';

export function CreateReelScreen({ navigation }: ScreenProps<'CreateReel'>) {
  const { colors } = useAppTheme();
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [hash, setHash] = useState('');
  const [filter, setFilter] = useState('normal');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [coverAt, setCoverAt] = useState(0);
  const [cover, setCover] = useState<LocalMedia | null>(null);
  const [music, setMusic] = useState('');
  const [places, setPlaces] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const uploadId = useRef('');
  const submit = useSubmitLock();
  const maxMs = maxDurationMs('reel') ?? 180_000;

  usePreventRemove(!!media && !busy, ({ data }) => {
    Alert.alert(
      'Discard this reel?',
      'Your video and description will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
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
    setCoverAt(0);
    setCover(null);
    setAudioMuted(false);
  };

  const share = () => {
    if (!media || busy) return;
    const duration = media.durationMs ?? endMs;
    const trimmed = endMs - startMs < duration - 200 || startMs > 0;
    if (endMs - startMs > maxMs) {
      Alert.alert('That clip is too long', 'A reel can be up to 3 minutes.');
      return;
    }
    if (endMs - startMs < 1000) {
      Alert.alert(
        'That clip is too short',
        'A reel has to be at least 1 second.',
      );
      return;
    }
    submit(async () => {
      setBusy(true);
      try {
        const asset = await uploadMedia(
          { ...media, durationMs: Math.max(1000, endMs - startMs) },
          'reel',
        );
        const coverAsset = cover ? await uploadMedia(cover, 'post') : null;
        await reelsApi.create({
          video_media_id: asset.id,
          caption: caption.trim(),
          location_name: location.trim(),
          location_lat: locationLat,
          location_lng: locationLng,
          filter,
          music_title: music.trim(),
          audio_muted: audioMuted,
          cover_time_ms: Math.round(coverAt),
          cover_media_id: coverAsset?.id,
          client_upload_id: uploadId.current,
          trim_start_ms: trimmed ? Math.round(startMs) : null,
          trim_end_ms: trimmed ? Math.round(endMs) : null,
        });
        navigation.popTo('Main', { screen: 'Reels' });
      } catch (err) {
        Alert.alert(
          "Couldn't share reel",
          err instanceof ApiError || err instanceof MediaError
            ? err.message
            : 'Please check your connection and try again.',
        );
        setBusy(false);
      }
    });
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar
        title="New reel"
        back
        actions={
          <Button
            title={busy ? 'Sharing…' : 'Share'}
            onPress={share}
            disabled={busy}
          />
        }
      />
      {media ? (
        <KeyboardAvoidingView style={styles.pick} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.preview}>
              <PlayableMedia
                uri={cover?.uri ?? media.uri}
                kind={cover ? 'image' : 'video'}
                trimStartMs={startMs}
                trimEndMs={endMs}
                forceMuted={audioMuted}
                style={StyleSheet.absoluteFill}
              />
              <LookTint id={filter} />
            </View>
            <View style={styles.looks}>
              <LookStrip value={filter} onChange={setFilter} />
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
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a description… #tags @people"
              placeholderTextColor={colors.textSecondary}
              maxLength={CAPTION_MAX}
              multiline
              accessibilityLabel="Description"
              style={[
                styles.caption,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <TextInput
              value={hash}
              onChangeText={setHash}
              onSubmitEditing={() => {
                const tag = hash
                  .trim()
                  .replace(/^#/, '')
                  .replace(/[^\w]/g, '')
                  .slice(0, 30);
                if (!tag) return;
                setCaption(current => {
                  const token = `#${tag}`;
                  if (current.toLowerCase().includes(token.toLowerCase())) {
                    return current;
                  }
                  const gap =
                    current.length === 0 || current.endsWith(' ') ? '' : ' ';
                  return `${current}${gap}${token}`.slice(0, CAPTION_MAX);
                });
                setHash('');
              }}
              placeholder="Add a hashtag"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              returnKeyType="done"
              accessibilityLabel="Add a hashtag"
              style={[
                styles.hash,
                { color: colors.text, borderColor: colors.border },
              ]}
            />
            <Button
              title={audioMuted ? 'Original audio off' : 'Original audio on'}
              variant="secondary"
              onPress={() => setAudioMuted(v => !v)}
              style={styles.row}
            />
            <Button
              title="Cover frame: start of clip"
              variant="secondary"
              onPress={() => {
                setCover(null);
                setCoverAt(startMs);
              }}
              style={styles.row}
            />
            <Button
              title="Cover frame: middle of clip"
              variant="secondary"
              onPress={() => {
                setCover(null);
                setCoverAt((startMs + endMs) / 2);
              }}
              style={styles.row}
            />
            <Button
              title="Choose cover photo"
              variant="secondary"
              onPress={async () => {
                try {
                  const items = await pickFromLibrary('post', {
                    kind: 'image',
                    limit: 1,
                  });
                  if (items[0]) setCover(items[0]);
                } catch (err) {
                  Alert.alert(
                    "Couldn't open photos",
                    err instanceof MediaError
                      ? err.message
                      : 'Please try again.',
                  );
                }
              }}
              style={styles.row}
            />
            <Button
              title={location || 'Add location'}
              variant="secondary"
              onPress={() => setPlaces(true)}
              style={styles.row}
            />
            <Button
              title={music || 'Add music'}
              variant="secondary"
              onPress={() => setMusicOpen(true)}
              style={styles.row}
            />
            <Button
              title="Mention people"
              variant="secondary"
              onPress={() => setPeopleOpen(true)}
              style={styles.row}
            />
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {caption.length}/{CAPTION_MAX}
            </Text>
            <Button
              title="Choose another video"
              variant="ghost"
              onPress={() =>
                Alert.alert(
                  'Choose another video?',
                  'This edit will be cleared.',
                  [
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
                        setCover(null);
                        setAudioMuted(false);
                        setMusic('');
                        setFilter('normal');
                        setHash('');
                      },
                    },
                  ],
                )
              }
              style={styles.row}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
      <LocationSheet
        visible={places}
        onClose={() => setPlaces(false)}
        onSelect={place => {
          setLocation(place.name);
          setLocationLat(place.latitude);
          setLocationLng(place.longitude);
        }}
      />
      <MusicSheet
        visible={musicOpen}
        onClose={() => setMusicOpen(false)}
        onSelect={setMusic}
      />
      <TagPeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onSelect={username => {
          const token = `@${username}`;
          setCaption(current => {
            if (current.includes(token)) return current;
            const gap =
              current.length === 0 || current.endsWith(' ') ? '' : ' ';
            return `${current}${gap}${token} `.slice(0, CAPTION_MAX);
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pick: { flex: 1 },
  preview: {
    height: 360,
    marginHorizontal: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  looks: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  hash: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  caption: {
    margin: spacing.md,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  row: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  count: {
    textAlign: 'right',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 12,
  },
});
