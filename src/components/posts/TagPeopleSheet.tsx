import { UserPlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { SearchField } from '@/components/ui/SearchField';
import { Avatar } from '@/components/ui/Avatar';
import { followsApi, type UserSummary } from '@/services/api/follows';
import { spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Inserts `@username` into the caption. The API saves that mention. */
  onSelect: (username: string) => void;
};

/** Search people and mention them. The name is written into the caption. */
export function TagPeopleSheet({ visible, onClose, onSelect }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 250);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  useEffect(() => {
    if (!q) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    followsApi
      .searchUsers(q, controller.signal)
      .then(setUsers)
      .catch(() => {
        if (!controller.signal.aborted) setUsers([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q]);

  const choose = (username: string) => {
    onSelect(username);
    onClose();
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
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            Tag people
          </Text>
          <IconButton onPress={onClose} accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </IconButton>
        </View>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or username"
          autoFocus
        />
        <FlatList
          data={users}
          keyExtractor={user => user.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item.username)}
              accessibilityRole="button"
              accessibilityLabel={`Mention @${item.username}`}
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
                  {item.display_name}
                </Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  @{item.username}
                </Text>
              </View>
              <UserPlus size={18} color={colors.primary} />
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {q
                  ? `No people found for "${q}".`
                  : 'Search for someone to mention them in the description.'}
              </Text>
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
    paddingLeft: spacing.md,
    paddingRight: 8,
    minHeight: 54,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
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
  loader: { marginTop: spacing.xl },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
  },
});
