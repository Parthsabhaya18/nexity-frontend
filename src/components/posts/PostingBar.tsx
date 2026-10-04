import { CheckCircle2, RotateCcw, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  discardShare,
  dismissShared,
  onPostShared,
  retryShare,
  useShareState,
} from '@/features/posts/postComposer';
import { radius, spacing, useAppTheme } from '@/theme';

/** Instagram's "Posting…" strip at the top of the feed while a post uploads. */
export function PostingBar() {
  const { colors } = useAppTheme();
  const { refreshUser } = useAuth();
  const share = useShareState();

  useEffect(
    () => onPostShared(() => refreshUser().catch(() => {})),
    [refreshUser],
  );

  if (!share) return null;
  const failed = share.status === 'failed';
  const done = share.status === 'done';
  const label = failed
    ? "Couldn't share your post"
    : done
    ? 'Your post has been shared'
    : share.status === 'sharing'
    ? 'Finishing up…'
    : 'Posting…';

  return (
    <View
      style={[styles.bar, { borderBottomColor: colors.border }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <Image
          source={{ uri: share.thumbnailUri }}
          style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
        />
        <View style={styles.text}>
          <Text
            style={[
              styles.label,
              { color: failed ? colors.danger : colors.text },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {failed && share.error ? (
            <Text
              style={[styles.sub, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {share.error}
            </Text>
          ) : null}
        </View>
        {failed ? (
          <>
            <Pressable
              onPress={retryShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={styles.action}
            >
              <RotateCcw size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={discardShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Discard post"
              style={styles.action}
            >
              <X size={22} color={colors.text} />
            </Pressable>
          </>
        ) : done ? (
          <Pressable
            onPress={dismissShared}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={styles.action}
          >
            <CheckCircle2 size={22} color={colors.success} />
          </Pressable>
        ) : null}
      </View>
      {!failed && !done ? (
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: `${Math.max(4, Math.round(share.progress * 100))}%`,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 40, height: 40, borderRadius: radius.sm },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 14.5, fontWeight: '700' },
  sub: { fontSize: 12.5, marginTop: 2 },
  action: { padding: 6 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
});
