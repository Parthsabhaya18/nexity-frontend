import { ChevronDown } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { useFollowAction } from '@/features/follows/useFollowAction';
import type { FollowStatus } from '@/services/api/follows';
import { radius, useAppTheme } from '@/theme';

type Props = {
  user: { id: string; username: string; is_private: boolean };
  status: FollowStatus;
  /** Shows "Follow back" instead of "Follow". */
  followsYou?: boolean;
  size?: 'sm' | 'lg';
  /** Replaces the default unfollow when "Following" is tapped (e.g. an action sheet). */
  onFollowingPress?: () => void;
  style?: ViewStyle;
};

export function FollowButton({
  user,
  status: serverStatus,
  followsYou,
  size = 'sm',
  onFollowingPress,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const { status, busy, follow, unfollow, cancelRequest } = useFollowAction(
    user,
    serverStatus,
  );

  const primary = status === 'none';
  const label =
    status === 'accepted'
      ? 'Following'
      : status === 'pending'
      ? 'Requested'
      : followsYou
      ? 'Follow back'
      : 'Follow';
  const onPress =
    status === 'accepted'
      ? onFollowingPress ?? unfollow
      : status === 'pending'
      ? cancelRequest
      : follow;
  const fg = primary ? colors.onButton : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${label}, @${user.username}`}
      accessibilityState={{ busy }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.sm,
        primary
          ? { backgroundColor: colors.button, borderColor: colors.button }
          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy && primary ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Text
            style={[styles.text, { color: fg }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
          {status === 'accepted' && onFollowingPress ? (
            <ChevronDown size={16} color={fg} />
          ) : null}
        </>
      )}
    </Pressable>
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
  sm: { minWidth: 104, height: 34, paddingHorizontal: 14 },
  lg: { flex: 1, height: 38, paddingHorizontal: 10 },
  text: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
