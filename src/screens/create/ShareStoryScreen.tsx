import { ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LocationSheet } from '@/components/posts/LocationSheet';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import {
  DEFAULT_SHARED_LAYOUT,
  SharedStoryFrame,
} from '@/components/stories/SharedStoryFrame';
import { StoryStage } from '@/components/stories/StoryStage';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { showToast } from '@/components/ui/Toast';
import { errorText } from '@/features/entities/optimistic';
import { overlayId, placed, type StoryOverlay } from '@/features/stories/overlay';
import { emitStoryShared } from '@/features/stories/storyEvents';
import type { ScreenProps } from '@/navigation/types';
import { type SharedLayout, storiesApi } from '@/services/api/stories';
import { radius, spacing } from '@/theme';

const WHITE = '#FFFFFF';
const GLASS = 'rgba(0,0,0,0.45)';

/**
 * "Add to story" from the share sheet: the story editor with the post or reel on it.
 * Pinch to zoom, drag to move (snaps to the middle), tap a post to show the full post
 * card, and add text, location or drawing like any story.
 */
export function ShareStoryScreen({ navigation, route }: ScreenProps<'ShareStory'>) {
  const { kind, id, media_index, url, video, username, avatar_url, caption, aspect_ratio } = route.params;
  const [layout, setLayout] = useState<SharedLayout>(DEFAULT_SHARED_LAYOUT);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [places, setPlaces] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const hasLocation = overlays.some(item => item.type === 'location');
      await storiesApi.share({
        kind,
        id,
        media_index,
        layout,
        location_name: hasLocation ? location : '',
        location_lat: hasLocation ? locationLat : null,
        location_lng: hasLocation ? locationLng : null,
        overlays: overlays.map(item =>
          item.type === 'poll' ? { ...item, votes: undefined } : item,
        ),
      });
      emitStoryShared();
      showToast('Added to your story', 'success');
      navigation.goBack();
    } catch (err) {
      setBusy(false);
      Alert.alert("Couldn't share story", errorText(err, 'Please try again.'));
    }
  };

  return (
    <View style={styles.root}>
      {kind === 'post' && !video ? (
        <>
          <Image
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={30}
          />
          <View style={styles.dim} />
        </>
      ) : null}

      <StoryStage
        overlays={overlays}
        editable={!busy}
        onChange={setOverlays}
        onAddLocation={() => setPlaces(true)}
        onFocusChange={setFocused}
        underlay={
          <SharedStoryFrame
            shared={{ kind, username, avatar_url, caption, aspect_ratio }}
            layout={layout}
            onChange={busy || focused ? undefined : setLayout}
          >
            <PlayableMedia
              uri={url}
              kind={video ? 'video' : 'image'}
              active={!busy}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          </SharedStoryFrame>
        }
      />

      {focused ? null : (
        <SafeAreaView style={styles.chrome} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.header} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.round}
            >
              <X size={24} color={WHITE} />
            </Pressable>
          </View>

          <View style={styles.flex} pointerEvents="box-none" />

          <View style={styles.bottom} pointerEvents="box-none">
            <Pressable
              onPress={share}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Share to your story"
              style={styles.share}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Text style={styles.shareText}>Your story</Text>
                  <ChevronRight size={18} color="#0F172A" />
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      )}

      <LocationSheet
        visible={places}
        onClose={() => setPlaces(false)}
        onSelect={place => {
          setLocation(place.name);
          setLocationLat(place.latitude);
          setLocationLng(place.longitude);
          setOverlays(current => {
            if (current.some(item => item.type === 'location')) {
              return current.map(item =>
                item.type === 'location'
                  ? { ...item, name: place.name.slice(0, 80), x: 0.5, y: 0.5 }
                  : item,
              );
            }
            return [
              ...current,
              {
                ...placed({
                  id: overlayId(),
                  type: 'location' as const,
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                  name: place.name.slice(0, 80),
                }),
                x: 0.5,
                y: 0.5,
              },
            ];
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    minWidth: 120,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: WHITE,
  },
  shareText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
});
