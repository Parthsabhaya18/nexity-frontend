import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { ReactionGroup } from '@/services/api/chat';
import { useAppTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';

export type ReactionPerson = {
  display_name: string;
  username?: string;
  avatar_url: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  reactions: readonly ReactionGroup[];
  meId: string | null;
  people: Record<string, ReactionPerson>;
  onRemoveMine: () => void;
};

/** One row per person, me first, then in reaction order. */
export function reactionRows(
  groups: readonly ReactionGroup[],
  meId: string | null,
  filter: string | null = null,
) {
  const rows = groups
    .filter(g => !filter || g.emoji === filter)
    .flatMap(g => g.user_ids.map(userId => ({ userId, emoji: g.emoji })));
  return [
    ...rows.filter(r => r.userId === meId),
    ...rows.filter(r => r.userId !== meId),
  ];
}

/** "Reactions" sheet: who reacted with what; tapping my own row removes it. */
export function ReactionDetailsSheet({
  visible,
  onClose,
  reactions,
  meId,
  people,
  onRemoveMine,
}: Props) {
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const activeFilter =
    filter && reactions.some(g => g.emoji === filter) ? filter : null;
  const rows = reactionRows(reactions, meId, activeFilter);
  const total = reactions.reduce((n, g) => n + g.count, 0);
  const close = () => {
    setFilter(null);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Reactions">
      {reactions.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {[{ emoji: null as string | null, count: total }, ...reactions].map(
            g => {
              const active = activeFilter === g.emoji;
              return (
                <Pressable
                  key={g.emoji ?? 'all'}
                  onPress={() => setFilter(g.emoji)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.filter,
                    active && { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.filterText, { color: colors.text }]}>
                    {g.emoji ? `${g.emoji} ${g.count}` : `All ${g.count}`}
                  </Text>
                </Pressable>
              );
            },
          )}
        </ScrollView>
      ) : null}
      <ScrollView contentContainerStyle={styles.list}>
        {rows.map(({ userId, emoji }) => {
          const mine = userId === meId;
          const person = people[userId];
          const name = mine ? 'You' : person?.display_name ?? 'Someone';
          return (
            <Pressable
              key={`${userId}:${emoji}`}
              onPress={() => {
                if (!mine) return;
                close();
                onRemoveMine();
              }}
              disabled={!mine}
              accessibilityRole={mine ? 'button' : undefined}
              accessibilityLabel={`${name} reacted ${emoji}${
                mine ? '. Tap to remove' : ''
              }`}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Avatar
                uri={person?.avatar_url ?? null}
                name={person?.display_name ?? name}
                size={44}
              />
              <View style={styles.who}>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {mine ? (
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    Tap to remove
                  </Text>
                ) : person?.username ? (
                  <Text
                    style={[styles.sub, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    @{person.username}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.emoji} allowFontScaling={false}>
                {emoji}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 12, paddingTop: 10, gap: 6 },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  filterText: { fontSize: 14, fontWeight: '700' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 1 },
  emoji: { fontSize: 26 },
});
