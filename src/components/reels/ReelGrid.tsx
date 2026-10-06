import { useNavigation } from '@react-navigation/native';
import { Clapperboard } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';

import { focusReel } from '@/features/reels/reelFocus';
import type { Reel } from '@/services/api/reels';
import { reelsApi } from '@/services/api/reels';
import { useAppTheme } from '@/theme';

const GAP = 2;

function ReelCover({ reel }: { reel: Reel }) {
  const video = useRef<VideoRef>(null);
  if (reel.cover_url) {
    return (
      <Image
        source={{ uri: reel.cover_url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    );
  }
  return (
    <Video
      ref={video}
      source={{ uri: reel.video_url }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      paused
      muted
      onLoad={() => {
        if (reel.cover_time_ms) video.current?.seek(reel.cover_time_ms / 1000);
      }}
    />
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
  const navigation = useNavigation();
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

  if (!items) return null;
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
            focusReel(reel);
            navigation.navigate('Main', { screen: 'Reels' });
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
          <ReelCover reel={reel} />
          <View style={styles.shade}>
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
  tile: {},
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
