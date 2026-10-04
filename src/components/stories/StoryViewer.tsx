import { Flag, Music, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportSheet } from '@/components/safety/ReportSheet';
import { LookTint } from '@/components/media/LookStrip';
import { StoryStage } from '@/components/stories/StoryStage';
import { Avatar } from '@/components/ui/Avatar';
import { PlayableMedia } from '@/components/posts/PlayableMedia';
import type { StoryOverlay } from '@/features/stories/overlay';
import type { StoryGroup } from '@/services/api/stories';
import { storiesApi } from '@/services/api/stories';
import { ApiError } from '@/services/api/client';
import { darkScreen } from '@/theme';

const IMAGE_MS = 5000;

export function StoryViewer({
  group,
  onClose,
}: {
  group: StoryGroup | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    setIndex(0);
  }, [group?.user.id]);

  const item = group?.stories[index];

  useEffect(() => {
    setOverlays(item?.overlays ?? []);
    setReplyId(null);
    setReplyText('');
    // Reload stickers when the story changes. A vote updates local state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    if (!item || item.seen) return;
    storiesApi.view(item.id).catch(() => {});
  }, [item]);

  useEffect(() => {
    if (!group || !item || item.kind === 'video' || reporting) return;
    const timer = setTimeout(() => {
      if (index + 1 < group.stories.length) setIndex(i => i + 1);
      else onClose();
    }, IMAGE_MS);
    return () => clearTimeout(timer);
  }, [group, item, index, onClose, reporting]);

  if (!group || !item) return null;

  const go = (dir: 1 | -1) => {
    const next = index + dir;
    if (next < 0) return;
    if (next >= group.stories.length) onClose();
    else setIndex(next);
  };

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.fill, { backgroundColor: darkScreen.background }]}>
        <PlayableMedia
          uri={item.url}
          kind={item.kind}
          active={!reporting}
          style={styles.fill}
        />
        <LookTint id={item.filter} />
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bars}>
            {group.stories.map((s, i) => (
              <View key={s.id} style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: i <= index ? '100%' : '0%' },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.meta}>
            <Avatar
              uri={group.user.avatar_url}
              name={group.user.display_name}
              size={32}
            />
            <View style={styles.nameWrap}>
              <Text style={styles.name} numberOfLines={1}>
                {group.user.username}
              </Text>
              {item.music_title ? (
                <View style={styles.musicRow}>
                  <Music size={12} color="#FFFFFF" />
                  <Text style={styles.music} numberOfLines={1}>
                    {item.music_title}
                  </Text>
                </View>
              ) : null}
            </View>
            {group.user.is_self ? null : (
              <Pressable
                onPress={() => setReporting(true)}
                accessibilityLabel="Report story"
                hitSlop={8}
              >
                <Flag color="#FFFFFF" size={22} />
              </Pressable>
            )}
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <X color="#FFFFFF" size={26} />
            </Pressable>
          </View>
        </View>
        <View style={styles.taps} pointerEvents="box-none">
          <Pressable
            style={styles.tap}
            onPress={() => go(-1)}
            accessibilityLabel="Previous"
          />
          <Pressable
            style={styles.tap}
            onPress={() => go(1)}
            accessibilityLabel="Next"
          />
        </View>
        <StoryStage
          overlays={overlays}
          onVote={(overlayId, option) => {
            storiesApi
              .vote(item.id, overlayId, option)
              .then(next => setOverlays(next.overlays ?? []))
              .catch(err =>
                Alert.alert(
                  "Couldn't save that vote",
                  err instanceof ApiError ? err.message : 'Please try again.',
                ),
              );
          }}
          onReply={setReplyId}
        />
        {replyId ? (
          <View style={[styles.reply, { bottom: insets.bottom + 24 }]}>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Your answer"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.replyInput}
            />
            <Pressable
              onPress={() => {
                const body = replyText.trim();
                if (!body) return;
                storiesApi
                  .reply(item.id, replyId, body)
                  .then(() => {
                    setReplyId(null);
                    setReplyText('');
                    Alert.alert('Answer sent');
                  })
                  .catch(err =>
                    Alert.alert(
                      "Couldn't send that answer",
                      err instanceof ApiError
                        ? err.message
                        : 'Please try again.',
                    ),
                  );
              }}
              accessibilityRole="button"
            >
              <Text style={styles.replySend}>Send</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <ReportSheet
        visible={reporting}
        targetType="story"
        targetId={item.id}
        blockUserId={group.user.is_self ? undefined : group.user.id}
        username={group.user.username}
        onClose={() => setReporting(false)}
        onBlocked={onClose}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { position: 'absolute', left: 8, right: 8, gap: 8 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
  },
  barFill: { height: 2, backgroundColor: '#FFFFFF' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameWrap: { flex: 1 },
  name: { color: '#FFFFFF', fontWeight: '700' },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  music: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', flex: 1 },
  taps: { ...StyleSheet.absoluteFill, top: 120, flexDirection: 'row' },
  tap: { flex: 1 },
  reply: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 14,
    padding: 10,
  },
  replyInput: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  replySend: { color: '#FFFFFF', fontWeight: '800' },
});
