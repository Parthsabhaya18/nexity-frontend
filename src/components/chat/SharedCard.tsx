import { Clapperboard, Lock, Play } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import Video from 'react-native-video';

import { Avatar } from '@/components/ui/Avatar';
import type { SharedRef } from '@/services/api/chat';
import { useAppTheme } from '@/theme';

const POST_WIDTH = 236;
const REEL_WIDTH = 190;
const PROFILE_WIDTH = 270;
const GRID_GAP = 2;
const CELL = (PROFILE_WIDTH - GRID_GAP * 2) / 3;
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

/** First frame of the shared media: the photo or cover when there is one, otherwise the paused video. */
function Frame({ shared, style }: { shared: SharedRef; style: object }) {
  if (shared.image_url) {
    return <Image source={{ uri: shared.image_url }} style={style} resizeMode="cover" />;
  }
  if (shared.video_url) {
    return (
      <Video
        source={{ uri: shared.video_url }}
        style={style}
        paused
        muted
        resizeMode="cover"
      />
    );
  }
  return <View style={style} />;
}

/** A post or reel sent in a chat (Instagram-style): author, media and caption. */
export function SharedCard({ shared, failed }: { shared: SharedRef; failed?: boolean }) {
  const { colors } = useAppTheme();
  const reel = shared.kind === 'reel';

  if (!shared.available || !shared.author) {
    return (
      <View style={[styles.unavailable, { borderColor: colors.border }]}>
        <Text style={[styles.unavailableText, { color: colors.textSecondary }]}>
          {reel ? 'Reel unavailable' : shared.kind === 'profile' ? 'Profile unavailable' : 'Post unavailable'}
        </Text>
      </View>
    );
  }

  if (shared.kind === 'profile') {
    const profile = shared.profile;
    const grid = profile?.grid ?? [];
    return (
      <View
        style={[styles.profile, { backgroundColor: colors.surfaceAlt }, failed && styles.failed]}
        accessibilityLabel={`Profile of ${shared.author.username}`}
      >
        <View style={styles.profileHeader}>
          <Avatar uri={shared.author.avatar_url} name={shared.author.username} size={40} />
          <View style={styles.profileNames}>
            <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
              {shared.author.username}
            </Text>
            {profile?.display_name ? (
              <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
                {profile.display_name}
              </Text>
            ) : null}
          </View>
        </View>
        {grid.length ? (
          <View style={styles.grid}>
            {grid.map((cell, i) => (
              <Frame
                key={`${cell.url}-${i}`}
                shared={{
                  ...shared,
                  image_url: cell.video ? null : cell.url,
                  video_url: cell.video ? cell.url : null,
                }}
                style={[styles.cell, { backgroundColor: colors.skeleton }]}
              />
            ))}
          </View>
        ) : profile?.is_private ? (
          <View style={styles.privateRow}>
            <Lock size={15} color={colors.textSecondary} />
            <Text style={[styles.privateText, { color: colors.textSecondary }]}>
              This account is private
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  const header = (light: boolean) => (
    <View style={styles.header}>
      <Avatar uri={shared.author!.avatar_url} name={shared.author!.username} size={26} />
      <Text
        style={[styles.username, light ? styles.light : { color: colors.text }]}
        numberOfLines={1}
      >
        {shared.author!.username}
      </Text>
    </View>
  );

  if (reel) {
    return (
      <View
        style={[styles.reel, failed && styles.failed]}
        accessibilityLabel={`Reel by ${shared.author.username}`}
      >
        <Frame shared={shared} style={StyleSheet.absoluteFill} />
        <View style={styles.reelShade} />
        <View style={styles.reelTop}>
          {header(true)}
          <Clapperboard size={18} color="#FFFFFF" />
        </View>
        <View style={styles.play}>
          <Play size={30} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        {shared.caption ? (
          <Text style={styles.reelCaption} numberOfLines={2}>
            {shared.caption}
          </Text>
        ) : null}
      </View>
    );
  }

  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, shared.aspect_ratio || 1));
  return (
    <View
      style={[styles.post, { backgroundColor: colors.surfaceAlt }, failed && styles.failed]}
      accessibilityLabel={`Post by ${shared.author.username}`}
    >
      <View style={styles.postHeader}>{header(false)}</View>
      <View>
        <Frame
          shared={shared}
          style={[styles.postMedia, { aspectRatio: ratio, backgroundColor: colors.skeleton }]}
        />
        {!shared.image_url && shared.video_url ? (
          <View style={styles.videoBadge}>
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        ) : null}
      </View>
      {shared.caption ? (
        <Text style={[styles.caption, { color: colors.text }]} numberOfLines={2}>
          <Text style={styles.bold}>{shared.author.username}</Text> {shared.caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  failed: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  username: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  light: { color: '#FFFFFF' },
  post: { width: POST_WIDTH, borderRadius: 18, overflow: 'hidden' },
  postHeader: { paddingHorizontal: 10, paddingVertical: 9 },
  postMedia: { width: POST_WIDTH },
  videoBadge: { position: 'absolute', top: 8, right: 8 },
  caption: { fontSize: 13.5, lineHeight: 18, paddingHorizontal: 10, paddingVertical: 9 },
  bold: { fontWeight: '700' },
  reel: {
    width: REEL_WIDTH,
    aspectRatio: 9 / 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  reelShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  reelTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  play: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelCaption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
  },
  profile: { width: PROFILE_WIDTH, borderRadius: 18, overflow: 'hidden' },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileNames: { flex: 1 },
  displayName: { fontSize: 12.5, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { width: CELL, height: CELL },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  privateText: { fontSize: 13 },
  unavailable: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  unavailableText: { fontSize: 14, fontStyle: 'italic' },
});
