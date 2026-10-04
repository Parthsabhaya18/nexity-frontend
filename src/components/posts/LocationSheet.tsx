import { MapPin, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
import {
  suggestPlaces,
  type PlaceRow,
  type RemotePlace,
} from '@/features/posts/places';
import { postsApi } from '@/services/api/posts';
import { spacing, useAppTheme } from '@/theme';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

export type PlacePick = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (place: PlacePick) => void;
};

/** Suggested places on open, filtered as the user searches. */
export function LocationSheet({ visible, onClose, onSelect }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 250);
  const [remote, setRemote] = useState<RemotePlace[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setRemote([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!q) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    postsApi
      .searchPlaces(q, controller.signal)
      .then(places => {
        if (!controller.signal.aborted) setRemote(places);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemote([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q]);

  const rows = useMemo(
    () => suggestPlaces(query, q === query.trim() ? remote : []),
    [query, q, remote],
  );

  const choose = (row: PlaceRow) => {
    onSelect({
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
    });
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
            Add location
          </Text>
          <IconButton onPress={onClose} accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </IconButton>
        </View>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search a place"
          autoFocus
        />
        <FlatList
          data={rows}
          keyExtractor={row => `${row.custom ? 'custom' : 'place'}:${row.name}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {query.trim() ? 'Search results' : 'Suggested places'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View
                style={[styles.pin, { backgroundColor: colors.surfaceAlt }]}
              >
                <MapPin size={20} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : undefined
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No places match that.
            </Text>
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
  hint: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 1 },
  loader: { marginVertical: spacing.md },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
});
