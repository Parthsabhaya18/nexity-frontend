import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOwnStoriesSeen } from '@/features/stories/storyEvents';
import type { StoryGroup } from '@/services/api/stories';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  groups: StoryGroup[];
  onOpen: (group: StoryGroup) => void;
  onCreate: () => void;
};

export function StoriesTray({ groups, onOpen, onCreate }: Props) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const ownStoriesSeen = useOwnStoriesSeen();
  const mine = groups.find(g => g.user.is_self);
  const others = groups.filter(g => !g.user.is_self);
  const mineRing = !mine
    ? 'transparent'
    : mine.seen || ownStoriesSeen(mine.stories)
    ? colors.border
    : colors.primary;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pressable
        onPress={mine ? () => onOpen(mine) : onCreate}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={mine ? 'View your story' : 'Add to your story'}
      >
        <View
          style={[
            styles.ring,
            { borderColor: mineRing },
          ]}
        >
          <Avatar
            uri={user?.avatar_url}
            name={user?.display_name ?? ''}
            size={62}
          />
          <Pressable
            onPress={onCreate}
            accessibilityLabel="Add to your story"
            style={[
              styles.plus,
              {
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            <Plus size={14} color={colors.onButton} />
          </Pressable>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          Your story
        </Text>
      </Pressable>
      {others.map(g => (
        <Pressable
          key={g.user.id}
          onPress={() => onOpen(g)}
          style={styles.item}
        >
          <View
            style={[
              styles.ring,
              { borderColor: g.seen ? colors.border : colors.primary },
            ]}
          >
            <Avatar
              uri={g.user.avatar_url}
              name={g.user.display_name}
              size={62}
            />
          </View>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {g.user.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function useStoryGroups(load: () => Promise<StoryGroup[]>) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const refresh = useCallback(async () => {
    try {
      setGroups(await load());
    } catch {
      // Tray stays as it was when the request fails.
    }
  }, [load]);
  return { groups, refresh, setGroups };
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingHorizontal: spacing.md, paddingVertical: 10 },
  item: { width: 74, alignItems: 'center', gap: 4 },
  name: { fontSize: 11, width: 74, textAlign: 'center' },
  ring: { borderWidth: 2, borderRadius: 36, padding: 2 },
  plus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
