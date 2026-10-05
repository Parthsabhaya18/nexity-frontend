import { usePreventRemove } from '@react-navigation/native';
import { ChevronRight, MapPin, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureView } from '@/components/create/CaptureView';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import { TagPeopleSheet } from '@/components/posts/TagPeopleSheet';
import { StoryStage } from '@/components/stories/StoryStage';
import { type LocalMedia, MediaError } from '@/features/media/pickMedia';
import {
  isUploadCancelled,
  uploadErrorMessage,
  uploadMedia,
} from '@/features/media/uploadMedia';
import { overlayId, placed, type StoryOverlay } from '@/features/stories/overlay';
import type { ScreenProps } from '@/navigation/types';
import { ApiError } from '@/services/api/client';
import { storiesApi } from '@/services/api/stories';
import { radius, spacing } from '@/theme';

// Story editing happens over the photo, so controls are white on dark glass.
const WHITE = '#FFFFFF';
const GLASS = 'rgba(0,0,0,0.45)';

/** Opens on the full-screen camera; then stickers, location and Share. */
export function CreateStoryScreen({ navigation }: ScreenProps<'CreateStory'>) {
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [places, setPlaces] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = progress !== null;

  usePreventRemove(!!media, ({ data }) => {
    Alert.alert(
      busy ? 'Stop sharing?' : 'Discard this story?',
      busy
        ? 'Your story is still uploading.'
        : 'This photo or video will not be shared.',
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

  const reset = () => {
    setMedia(null);
    setOverlays([]);
    setLocation('');
    setLocationLat(null);
    setLocationLng(null);
  };

  const share = async () => {
    if (!media || busy) return;
    const c = new AbortController();
    controller.current = c;
    setProgress(0);
    try {
      const asset = await uploadMedia(media, 'story', {
        signal: c.signal,
        onProgress: f => setProgress(Math.min(0.95, f * 0.95)),
      });
      await storiesApi.create({
        media_id: asset.id,
        location_name: location,
        location_lat: locationLat,
        location_lng: locationLng,
        overlays: overlays.map(item =>
          item.type === 'poll' ? { ...item, votes: undefined } : item,
        ),
      });
      setProgress(1);
      // Leaving is allowed now that the story is live.
      setMedia(null);
      setTimeout(() => navigation.goBack(), 0);
    } catch (err) {
      setProgress(null);
      if (c.signal.aborted || isUploadCancelled(err)) return;
      Alert.alert(
        "Couldn't share story",
        err instanceof ApiError || err instanceof MediaError
          ? err.message
          : uploadErrorMessage(err),
      );
    }
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
    <View style={styles.root}>
      <PlayableMedia
        uri={media.uri}
        kind={media.kind}
        active={!busy}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <StoryStage
        overlays={overlays}
        editable={!busy}
        onChange={setOverlays}
        onTagPeople={() => setPeopleOpen(true)}
      />

      <SafeAreaView style={styles.chrome} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <Pressable
            onPress={() =>
              Alert.alert('Start over?', 'This photo or video and its stickers will be cleared.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Start over', style: 'destructive', onPress: reset },
              ])
            }
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Back to camera"
            hitSlop={8}
            style={styles.round}
          >
            <X size={24} color={WHITE} />
          </Pressable>
        </View>

        <View style={styles.flex} pointerEvents="box-none" />

        <View style={styles.bottom} pointerEvents="box-none">
          <Pressable
            onPress={() => setPlaces(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={location ? `Location ${location}. Change` : 'Add location'}
            style={styles.pill}
          >
            <MapPin size={16} color={WHITE} />
            <Text style={styles.pillText} numberOfLines={1}>
              {location || 'Location'}
            </Text>
            {location ? (
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
                <X size={14} color={WHITE} />
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable
            onPress={share}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Share to your story"
            style={styles.share}
          >
            {busy ? (
              <>
                <ActivityIndicator size="small" color="#0F172A" />
                <Text style={styles.shareText}>
                  {Math.round((progress ?? 0) * 100)}%
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.shareText}>Your story</Text>
                <ChevronRight size={18} color="#0F172A" />
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

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
        selected={[]}
        onClose={() => setPeopleOpen(false)}
        onDone={people => {
          const already = new Set(
            overlays.flatMap(o => (o.type === 'mention' ? [o.username] : [])),
          );
          const added = people
            .filter(u => !already.has(u.username))
            .map(u =>
              placed({
                id: overlayId(),
                type: 'mention',
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                username: u.username,
              }),
            );
          if (added.length) setOverlays(current => [...current, ...added].slice(0, 12));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  chrome: { ...StyleSheet.absoluteFill },
  header: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: 4 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: GLASS,
  },
  pillText: { color: WHITE, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: WHITE,
  },
  shareText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
});
