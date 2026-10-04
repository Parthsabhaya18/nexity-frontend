import { usePreventRemove } from '@react-navigation/native';
import { Music, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureView } from '@/components/create/CaptureView';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { MusicSheet } from '@/components/posts/MusicSheet';
import { TagPeopleSheet } from '@/components/posts/TagPeopleSheet';
import { LookStrip, LookTint } from '@/components/media/LookStrip';
import { StoryStage } from '@/components/stories/StoryStage';
import { Button } from '@/components/ui/Button';
import { useSubmitLock } from '@/features/auth/useSubmitLock';
import { uploadMedia } from '@/features/media/uploadMedia';
import { type LocalMedia, MediaError } from '@/features/media/pickMedia';
import {
  overlayId,
  placed,
  type StoryOverlay,
} from '@/features/stories/overlay';
import { storiesApi } from '@/services/api/stories';
import { ApiError } from '@/services/api/client';
import type { ScreenProps } from '@/navigation/types';
import { darkScreen, spacing } from '@/theme';

/** Opens on the camera, like the prototype. Then text, mentions and looks. */
export function CreateStoryScreen({ navigation }: ScreenProps<'CreateStory'>) {
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [music, setMusic] = useState('');
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [filter, setFilter] = useState('normal');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [places, setPlaces] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = useSubmitLock();

  usePreventRemove(!!media && !busy, ({ data }) => {
    Alert.alert(
      'Discard this story?',
      'This photo or video will not be shared.',
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

  const share = () => {
    if (!media || busy) return;
    submit(async () => {
      setBusy(true);
      try {
        const asset = await uploadMedia(media, 'story');
        await storiesApi.create({
          media_id: asset.id,
          music_title: music,
          location_name: location,
          location_lat: locationLat,
          location_lng: locationLng,
          filter,
          overlays: overlays.map(item =>
            item.type === 'poll' ? { ...item, votes: undefined } : item,
          ),
        });
        navigation.goBack();
      } catch (err) {
        Alert.alert(
          "Couldn't share story",
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
        mode="story"
        onClose={() => navigation.goBack()}
        onDone={items => {
          if (items[0]) setMedia(items[0]);
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: darkScreen.background }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Choose another?',
              'The story you started will be cleared.',
              [
                { text: 'Keep editing', style: 'cancel' },
                {
                  text: 'Choose another',
                  style: 'destructive',
                  onPress: () => {
                    setMedia(null);
                    setMusic('');
                    setOverlays([]);
                    setFilter('normal');
                    setLocation('');
                    setLocationLat(null);
                    setLocationLng(null);
                  },
                },
              ],
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to camera"
          hitSlop={8}
        >
          <X size={28} color={darkScreen.text} />
        </Pressable>
        <Text style={[styles.title, { color: darkScreen.text }]}>
          Your story
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <>
        <View style={styles.preview}>
          <PlayableMedia
            uri={media.uri}
            kind={media.kind}
            style={styles.preview}
          />
          <LookTint id={filter} />
          <StoryStage
            overlays={overlays}
            editable
            onChange={setOverlays}
            onTagPeople={() => setPeopleOpen(true)}
          />
        </View>
        <View style={styles.tools}>
          <LookStrip value={filter} onChange={setFilter} tone="dark" />
          <Text style={styles.hint}>
            Drag text and mentions on the photo. Tap a filter to change the
            look.
          </Text>
          <View style={styles.music}>
            <Pressable
              onPress={() => setMusicOpen(true)}
              accessibilityRole="button"
              style={styles.musicMain}
            >
              <Music size={18} color="#FFFFFF" />
              <Text style={styles.musicText} numberOfLines={1}>
                {music || 'Add music'}
              </Text>
            </Pressable>
            {music ? (
              <Pressable
                onPress={() => setMusic('')}
                accessibilityRole="button"
                accessibilityLabel="Remove music"
                hitSlop={8}
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
          <Button
            title={location || 'Add location'}
            variant="secondary"
            onPress={() => setPlaces(true)}
          />
          <Button
            title={busy ? 'Sharing…' : 'Share to story'}
            onPress={share}
            disabled={busy}
          />
          <Text style={styles.hint}>Disappears after 24 hours</Text>
        </View>
      </>

      <MusicSheet
        visible={musicOpen}
        onClose={() => setMusicOpen(false)}
        onSelect={setMusic}
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
      <TagPeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onSelect={username => {
          setOverlays(current => [
            ...current,
            placed({
              id: overlayId(),
              type: 'mention',
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              username,
            }),
          ]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: { width: 28 },
  preview: { flex: 1 },
  tools: { padding: spacing.md, gap: 10 },
  music: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  musicMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  musicText: { color: '#FFFFFF', fontWeight: '700', flex: 1 },
  hint: { color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
});
