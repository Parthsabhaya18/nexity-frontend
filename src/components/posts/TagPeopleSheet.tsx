import { Check, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { SearchField } from '@/components/ui/SearchField';
import { MAX_TAGGED } from '@/features/posts/caption';
import { followsApi, type UserSummary } from '@/services/api/follows';
import { spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

type Props = {
  visible: boolean;
  /** People already tagged; they show as selected. */
  selected: UserSummary[];
  onClose: () => void;
  /** Called with the final list when the user taps Done. */
  onDone: (people: UserSummary[]) => void;
};

/** Search people and tick as many as needed (up to 20), then tap Done. */
export function TagPeopleSheet({ visible, selected, onClose, onDone }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 250);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<UserSummary[]>([]);
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    if (visible) {
      setPicked(selected);
      setQuery('');
      setLimitHit(false);
    }
    // Only reset when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setLoading(true);
    const request = q
      ? followsApi.searchUsers(q, controller.signal)
      : followsApi.suggestUsers(controller.signal);
    request
      .then(list => {
        if (!controller.signal.aborted) setUsers(list.filter(u => !u.is_self));
      })
      .catch(() => {
        if (!controller.signal.aborted) setUsers([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, visible]);

  const toggle = (user: UserSummary) => {
    setPicked(current => {
      if (current.some(u => u.id === user.id)) {
        setLimitHit(false);
        return current.filter(u => u.id !== user.id);
      }
      if (current.length >= MAX_TAGGED) {
        setLimitHit(true);
        return current;
      }
      return [...current, user];
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <IconButton onPress={onClose} accessibilityLabel="Cancel">
            <X size={24} color={colors.text} />
          </IconButton>
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            Tag people
          </Text>
          <Pressable
            onPress={() => {
              onDone(picked);
              onClose();
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.done}
          >
            <Text style={[styles.doneText, { color: colors.primary }]}>
              Done{picked.length ? ` (${picked.length})` : ''}
            </Text>
          </Pressable>
        </View>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or username"
        />
        {limitHit ? (
          <Text style={[styles.limit, { color: colors.danger }]}>
            You can tag up to {MAX_TAGGED} people.
          </Text>
        ) : null}
        <FlatList
          data={users}
          keyExtractor={user => user.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = picked.some(u => u.id === item.id);
            return (
              <Pressable
                onPress={() => toggle(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Tag ${item.username}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
                <View style={styles.rowText}>
                  <Text
                    style={[styles.name, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.username}
                  </Text>
                  <Text
                    style={[styles.sub, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.display_name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {on ? <Check size={14} color={colors.onButton} /> : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <UserListSkeleton avatar={44} rowStyle={styles.row} />
            ) : (
              <View style={styles.emptyWrap}>
                <Search size={28} color={colors.textSecondary} />
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  {q ? `No people found for "${q}".` : 'No suggestions yet.'}
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 54,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  done: { paddingHorizontal: 8, paddingVertical: 8, minWidth: 64, alignItems: 'flex-end' },
  doneText: { fontSize: 16, fontWeight: '800' },
  limit: { paddingHorizontal: spacing.md, paddingBottom: 4, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', gap: 8, marginTop: spacing.xl },
  empty: { textAlign: 'center', fontSize: 14 },
});
