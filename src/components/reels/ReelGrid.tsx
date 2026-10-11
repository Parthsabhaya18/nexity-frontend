import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Clapperboard } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { createVideoThumbnail } from 'react-native-compressor';

import { PostGridSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { focusReel } from '@/features/reels/reelFocus';
import type { RootStackParamList } from '@/navigation/types';
import type { Reel } from '@/services/api/reels';
import { reelsApi } from '@/services/api/reels';
import { useAppTheme } from '@/theme';

const GAP = 2;
const thumbs = new Map<string, string>();

function thumbUri(path: string) {
  if (
    path.startsWith('file://') ||
    path.startsWith('content://') ||
    path.startsWith('http')
  ) {
    return path;
  }
  return `file://${path}`;
}

export function ReelCover({ reel }: { reel: Reel }) {
  const { colors } = useAppTheme();
  const [uri, setUri] = useState<string | null>(
    reel.cover_url || thumbs.get(reel.video_url) || null,
  );

  useEffect(() => {
    if (reel.cover_url) {
      setUri(reel.cover_url);
      return;
    }
    const cached = thumbs.get(reel.video_url);
    if (cached) {
      setUri(cached);
      return;
    }
    let live = true;
    createVideoThumbnail(reel.video_url)
      .then(result => {
        const next = thumbUri(result.path);
        thumbs.set(reel.video_url, next);
        if (live) setUri(next);
      })
      .catch(() => {
        if (live) setUri(null);
      });
    return () => {
      live = false;
    };
  }, [reel.cover_url, reel.video_url]);

  if (!uri) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt }]} />
    );
  }
  return (
    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
  );
}

/** Profile reels. The tile shows the cover frame; tap plays that reel. */
export function ReelGrid({
  userId,
  empty,
}: {
  userId: string;
  empty: ReactNode;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(width);
  // Rounded down: three tiles that add up to even a fraction over the row wrap to two columns.
  const size = Math.floor((gridWidth - GAP * 2) / 3);
  const [items, setItems] = useState<Reel[] | null>(null);

  useEffect(() => {
    let live = true;
    reelsApi
      .byUser(userId)
      .then(page => {
        if (live) setItems(page.items);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (!items) return <PostGridSkeleton size={size} count={6} tileHeight={size * 1.35} />;
  if (!items.length) return <>{empty}</>;
  return (
    <View
      style={styles.wrap}
      onLayout={e => setGridWidth(e.nativeEvent.layout.width)}
    >
      {items.map(reel => (
        <Pressable
          key={reel.id}
          onPress={() => {
            focusReel(reel, userId);
            // Profiles sit above the tabs in the stack; go back down to them instead of pushing.
            navigation.popTo('Main', { screen: 'Reels' });
          }}
          accessibilityRole="button"
          accessibilityLabel="Play reel"
          style={[
            styles.tile,
            {
              width: size,
              height: size * 1.35,
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ReelCover reel={reel} />
          </View>
          <View style={styles.shade} pointerEvents="none">
            <Clapperboard size={18} color="#FFFFFF" />
            <Text style={styles.likes}>{reel.likes_count}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { overflow: 'hidden' },
  shade: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likes: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
