import { Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { UserSummary } from '@/services/api/follows';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  user: Pick<
    UserSummary,
    'username' | 'display_name' | 'avatar_url' | 'is_private'
  >;
  onPress: () => void;
  /** Buttons on the right, e.g. Follow or Remove. */
  trailing?: ReactNode;
};

export function UserRow({ user, onPress, trailing }: Props) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${user.display_name}, @${user.username}`}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <Avatar uri={user.avatar_url} name={user.display_name} size={48} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.username, { color: colors.text }]}
            numberOfLines={1}
          >
            {user.username}
          </Text>
          {user.is_private ? (
            <Lock size={12} color={colors.textSecondary} strokeWidth={2.6} />
          ) : null}
        </View>
        <Text
          style={[styles.name, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {user.display_name}
        </Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  text: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  name: { fontSize: 13.5, marginTop: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
