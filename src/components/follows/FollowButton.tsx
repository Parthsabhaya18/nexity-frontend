import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { ActionSheet } from '@/components/ui/ActionSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  canMessage,
  getRelation,
  primeUsers,
  type Relationship,
  relationshipFromFollow,
  type UserRelation,
  useRelation,
} from '@/features/entities/entityCache';
import {
  cancelFollowRequest,
  followUser,
  setMuted,
  unfollowUser,
} from '@/features/entities/entityActions';
import type { FollowStatus } from '@/services/api/follows';
import { darkScreen, radius, useAppTheme } from '@/theme';

export type FollowButtonVariant = 'full' | 'compact' | 'row';

type Props = {
  user: { id: string; username: string; is_private: boolean };
  /** Status as loaded with the user; the shared cache wins once it knows better. */
  status?: FollowStatus;
  /** Full relation as loaded (wins over `status`), e.g. from a profile or a mock. */
  relation?: Partial<UserRelation>;
  /** Shows "Follow back" instead of "Follow". */
  followsYou?: boolean;
  /**
   * `full`: profile header (stretches, optional Message button beside it).
   * `compact`: small pill for Reel / Story headers over media.
   * `row`: fixed width for list rows (default).
   */
  variant?: FollowButtonVariant;
  /** @deprecated use `variant`: `lg` = `full`, `sm` = `row`. */
  size?: 'sm' | 'lg';
  /** Replaces the default Following menu (Unfollow / Mute). */
  onFollowingPress?: () => void;
  /** Shows a Message button (full and row) when messaging is allowed. */
  onMessage?: () => void;
  messageLoading?: boolean;
  style?: ViewStyle;
};

type Menu = 'following' | 'unfollow' | 'request' | null;

const labelFor = (r: Relationship, followsYou: boolean) =>
  r === 'following'
    ? 'Following'
    : r === 'requested'
    ? 'Requested'
    : followsYou
    ? 'Follow back'
    : 'Follow';

/**
 * Follow / Following / Requested for one user, read from and written to the
 * shared entity cache, so every screen showing this user updates at once.
 * Hidden when either side blocked the other.
 */
export function FollowButton({
  user,
  status,
  relation: loaded,
  followsYou,
  variant: variantProp,
  size,
  onFollowingPress,
  onMessage,
  messageLoading,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const { refreshUser } = useAuth();
  const variant = variantProp ?? (size === 'lg' ? 'full' : 'row');
  const cached = useRelation(user.id);
  const [menu, setMenu] = useState<Menu>(null);
  const [menusMounted, setMenusMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  const fallback: UserRelation = {
    relationship:
      loaded?.relationship ?? relationshipFromFollow(status ?? 'none'),
    follows_you: loaded?.follows_you ?? !!followsYou,
    is_private: loaded?.is_private ?? user.is_private,
    muted: loaded?.muted ?? false,
  };
  const rel = cached ?? fallback;

  // Seed the cache so other screens (and actions) see what this one loaded.
  const seedKey = `${user.id}|${fallback.relationship}|${fallback.follows_you}|${fallback.is_private}|${fallback.muted}`;
  useEffect(() => {
    if (!getRelation(user.id)) primeUsers([{ id: user.id, ...fallback }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  if (
    rel.relationship === 'blocked_by_me' ||
    rel.relationship === 'blocked_me'
  ) {
    return null;
  }

  const open = (m: Menu) => {
    setMenusMounted(true);
    setMenu(m);
  };
  const act = async (task: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    try {
      if ((await task()).ok) refreshUser().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const onPress = () => {
    if (rel.relationship === 'following') {
      if (onFollowingPress) onFollowingPress();
      else open('following');
    } else if (rel.relationship === 'requested') {
      open('request');
    } else {
      act(() => followUser({ id: user.id, is_private: rel.is_private }));
    }
  };

  const unfollow = () => {
    if (rel.is_private) open('unfollow');
    else {
      setMenu(null);
      act(() => unfollowUser(user.id));
    }
  };

  const primary = rel.relationship === 'none';
  const label = labelFor(rel.relationship, rel.follows_you);
  const onMedia = variant === 'compact';
  const outlineColor = onMedia ? darkScreen.text : colors.border;
  const fg = primary
    ? colors.onButton
    : onMedia
    ? darkScreen.text
    : colors.text;
  const showMessage = !!onMessage && variant !== 'compact' && canMessage(rel);
  const variantStyle =
    variant === 'full'
      ? styles.full
      : variant === 'compact'
      ? styles.compact
      : styles.row;

  const button = (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${label}, @${user.username}`}
      accessibilityHint={
        rel.relationship === 'following'
          ? 'Opens unfollow and mute options'
          : rel.relationship === 'requested'
          ? 'Asks to cancel the follow request'
          : undefined
      }
      accessibilityState={{ busy }}
      hitSlop={variant === 'compact' ? 8 : 4}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        primary
          ? { backgroundColor: colors.button, borderColor: colors.button }
          : { backgroundColor: 'transparent', borderColor: outlineColor },
        pressed && styles.pressed,
        !showMessage && style,
      ]}
    >
      {busy && primary ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Text
            style={[
              styles.text,
              variant === 'compact' && styles.compactText,
              { color: fg },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
          {rel.relationship === 'following' && variant === 'full' ? (
            <ChevronDown size={16} color={fg} />
          ) : null}
        </>
      )}
    </Pressable>
  );

  return (
    <>
      {showMessage ? (
        <View
          style={[styles.pair, variant === 'full' && styles.pairFull, style]}
        >
          {button}
          <Pressable
            onPress={onMessage}
            disabled={messageLoading}
            accessibilityRole="button"
            accessibilityLabel={`Message @${user.username}`}
            accessibilityState={{ busy: !!messageLoading }}
            hitSlop={4}
            style={({ pressed }) => [
              styles.base,
              variantStyle,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.surfaceAlt,
              },
              pressed && styles.pressed,
            ]}
          >
            {messageLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text
                style={[styles.text, { color: colors.text }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                Message
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        button
      )}

      {menusMounted ? (
        <>
          <ActionSheet
            visible={menu === 'following'}
            title={`@${user.username}`}
            onClose={() => setMenu(null)}
            options={[
              { label: 'Unfollow', destructive: true, onPress: unfollow },
              {
                label: rel.muted ? 'Unmute' : 'Mute',
                onPress: () => {
                  setMenu(null);
                  setMuted(user.id, !rel.muted);
                },
              },
            ]}
          />
          <ConfirmDialog
            visible={menu === 'unfollow'}
            title={`Unfollow @${user.username}?`}
            message="Their account is private, so you'll need to send a new request to see their posts."
            confirmLabel="Unfollow"
            destructive
            onConfirm={() => {
              setMenu(null);
              act(() => unfollowUser(user.id));
            }}
            onCancel={() => setMenu(null)}
          />
          <ConfirmDialog
            visible={menu === 'request'}
            title="Cancel follow request?"
            message={`@${user.username} won't see your request anymore.`}
            confirmLabel="Cancel request"
            cancelLabel="Keep"
            destructive
            onConfirm={() => {
              setMenu(null);
              act(() => cancelFollowRequest(user.id));
            }}
            onCancel={() => setMenu(null)}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  row: { minWidth: 104, height: 34, paddingHorizontal: 14 },
  full: { flex: 1, height: 38, paddingHorizontal: 10 },
  compact: { height: 28, paddingHorizontal: 12, borderRadius: radius.full },
  pair: { flexDirection: 'row', gap: 8 },
  pairFull: { flex: 1 },
  text: { fontSize: 14, fontWeight: '700' },
  compactText: { fontSize: 13 },
  pressed: { opacity: 0.75 },
});
