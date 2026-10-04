import { Music, X } from 'lucide-react-native';
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

import { IconButton } from '@/components/ui/IconButton';
import { SearchField } from '@/components/ui/SearchField';
import { spacing, useAppTheme } from '@/theme';

export const MUSIC_MAX = 80;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (title: string) => void;
};

/** Song name for a post, reel or story. What you type is always a choice. */
export function MusicSheet({ visible, onClose, onSelect }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const typed = query.trim().slice(0, MUSIC_MAX);

  const choose = (title: string) => {
    onSelect(title);
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
            Add music
          </Text>
          <IconButton onPress={onClose} accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </IconButton>
        </View>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Song or sound name"
          autoFocus
        />
        <FlatList
          data={typed ? [typed] : []}
          keyExtractor={item => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View
                style={[styles.pin, { backgroundColor: colors.surfaceAlt }]}
              >
                <Music size={20} color={colors.text} />
              </View>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {item}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              Type a song name. It shows on your post, reel or story.
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
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
  },
});
