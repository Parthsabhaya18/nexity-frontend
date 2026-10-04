import { useFocusEffect } from '@react-navigation/native';
import { Clapperboard, Flag, Heart, MapPin, Music } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LookTint } from '@/components/media/LookStrip';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import { CaptionText } from '@/components/posts/CaptionText';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { Button } from '@/components/ui/Button';
import { usePagedList } from '@/features/follows/usePagedList';
import { consumeFocusedReel } from '@/features/reels/reelFocus';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { type Reel, reelsApi } from '@/services/api/reels';
import { darkScreen } from '@/theme';

export function ReelsScreen({ navigation }: TabScreenProps<'Reels'>) {
  const { height } = useWindowDimensions();
  const bottomInset = useTabBarInset();
  const page = height;
  const [visible, setVisible] = useState<string | null>(null);
  const [report, setReport] = useState<Reel | null>(null);
  const pendingId = useRef<string | null>(null);
  useStatusBar('dark');
  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      reelsApi.feed(cursor, signal),
    [],
  );
  const list = usePagedList<Reel>(fetchPage);

  useFocusEffect(
    useCallback(() => {
      const focus = consumeFocusedReel();
      if (!focus) return;
      if ('video_url' in focus) {
        list.setItems(prev => [
          focus,
          ...prev.filter(item => item.id !== focus.id),
        ]);
        setVisible(focus.id);
        pendingId.current = null;
      } else {
        pendingId.current = focus.id;
      }
    }, [list.setItems]),
  );

  useEffect(() => {
    const id = pendingId.current;
    if (!id || !list.items.some(item => item.id === id)) return;
    pendingId.current = null;
    list.setItems(prev => {
      const found = prev.find(item => item.id === id);
      if (!found) return prev;
      return [found, ...prev.filter(item => item.id !== id)];
    });
    setVisible(id);
  }, [list.items, list.setItems]);

  const like = async (reel: Reel) => {
    const next = await reelsApi.like(reel.id).catch(() => null);
    if (!next) return;
    list.setItems(prev => prev.map(r => (r.id === reel.id ? next : r)));
  };

  return (
    <View style={[styles.safe, { backgroundColor: darkScreen.background }]}>
      <FlatList
        data={list.items}
        keyExtractor={r => r.id}
        pagingEnabled
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        refreshing={list.refreshing}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        onViewableItemsChanged={({ viewableItems }) =>
          setVisible(viewableItems[0]?.item.id ?? null)
        }
        ListEmptyComponent={
          <SafeAreaView style={{ height: page }}>
            <View style={[styles.empty, { paddingBottom: bottomInset }]}>
              <Clapperboard size={34} color={darkScreen.text} />
              <Text style={styles.emptyTitle}>No reels yet</Text>
              <Button
                title="Create a reel"
                onPress={() => navigation.navigate('CreateReel')}
              />
            </View>
          </SafeAreaView>
        }
        renderItem={({ item }) => (
          <View style={{ height: page }}>
            <PlayableMedia
              uri={item.video_url}
              kind="video"
              active={item.id === visible}
              trimStartMs={item.trim_start_ms}
              trimEndMs={item.trim_end_ms}
              forceMuted={!!item.audio_muted}
              style={styles.fill}
            />
            <LookTint id={item.filter} />
            <View style={[styles.overlay, { bottom: bottomInset + 16 }]}>
              <Text style={styles.user}>@{item.author.username}</Text>
              {item.location_name ? (
                <View style={styles.loc}>
                  <MapPin size={14} color="#FFFFFF" />
                  <Text style={styles.locText}>{item.location_name}</Text>
                </View>
              ) : null}
              {item.music_title ? (
                <View style={styles.loc}>
                  <Music size={14} color="#FFFFFF" />
                  <Text style={styles.locText}>{item.music_title}</Text>
                </View>
              ) : null}
              {item.caption ? (
                <CaptionText caption={item.caption} color="#FFFFFF" />
              ) : null}
            </View>
            <Pressable
              onPress={() => setReport(item)}
              style={[styles.report, { bottom: bottomInset + 96 }]}
              accessibilityLabel="Report reel"
            >
              <Flag size={26} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => like(item)}
              style={[styles.like, { bottom: bottomInset + 24 }]}
              accessibilityLabel="Like reel"
            >
              <Heart
                size={30}
                color={item.liked_by_me ? '#F0386B' : '#FFFFFF'}
                fill={item.liked_by_me ? '#F0386B' : 'transparent'}
              />
              <Text style={styles.likeCount}>{item.likes_count}</Text>
            </Pressable>
          </View>
        )}
      />
      {report ? (
        <ReportSheet
          visible
          targetType="reel"
          targetId={report.id}
          blockUserId={report.author.is_self ? undefined : report.author.id}
          username={report.author.username}
          onClose={() => setReport(null)}
          onBlocked={() => {
            list.setItems(prev =>
              prev.filter(item => item.author.id !== report.author.id),
            );
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  overlay: { position: 'absolute', left: 12, right: 70 },
  user: { color: '#FFFFFF', fontWeight: '800', marginBottom: 4 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  locText: { color: '#FFFFFF', fontSize: 13 },
  report: { position: 'absolute', right: 14, alignItems: 'center' },
  like: { position: 'absolute', right: 12, alignItems: 'center' },
  likeCount: { color: '#FFFFFF', fontSize: 12, marginTop: 4 },
});
