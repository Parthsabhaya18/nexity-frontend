import { CloudOff, Search, Users, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { UserListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { chat } from '@/features/chats/chatController';
import { presenceOf, useChatStore } from '@/features/chats/chatStore';
import { ApiError } from '@/services/api/client';
import { type ChatUser, chatApi } from '@/services/api/chat';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

const SEARCH_DEBOUNCE_MS = 250;

export function NewMessageScreen({ navigation }: ScreenProps<'NewMessage'>) {
  const { colors } = useAppTheme();
  const presence = useChatStore(s => s.presence);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  useStatusBar();

  const q = query.trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const found = await chatApi.searchUsers(q);
          if (!cancelled) {
            setPeople(found);
            setError(null);
          }
        } catch (err) {
          if (!cancelled)
            setError(
              err instanceof ApiError ? err.message : 'Could not search.',
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      q ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const start = async (person: ChatUser) => {
    if (opening) return;
    setOpening(person.id);
    try {
      const conversationId = await chat.openDirect(person.id);
      navigation.replace('ChatThread', { conversationId });
    } catch (err) {
      setOpening(null);
      Alert.alert(
        "Couldn't start chat",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="New message" back />
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: focused ? colors.surface : colors.inputBackground,
            borderColor: focused ? colors.primary : colors.border,
          },
        ]}
      >
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search people"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search people"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={people}
        keyExtractor={p => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          !q && people.length ? (
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              Suggested
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => start(item)}
            disabled={Boolean(opening)}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.display_name}`}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Avatar
              uri={item.avatar_url}
              name={item.display_name}
              size={44}
              online={presenceOf(item, presence).online}
            />
            <View style={styles.rowText}>
              <Text
                style={[styles.username, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.username}
              </Text>
              <Text
                style={[styles.name, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.display_name}
              </Text>
            </View>
            {opening === item.id ? (
              <ActivityIndicator color={colors.primary} />
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <UserListSkeleton avatar={44} rowStyle={[styles.row, styles.skeletonRow]} />
          ) : error ? (
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title="Couldn't load people"
              text={error}
            />
          ) : (
            <EmptyState
              icon={<Users size={34} color={colors.primary} />}
              title={q ? 'No people found' : 'No one here yet'}
              text={
                q
                  ? `No accounts match "${q}".`
                  : 'When more people join Nexity, you can message them here.'
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchBox: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    marginHorizontal: spacing.md,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
    marginTop: 4,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, minWidth: 0 },
  username: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 13, marginTop: 1 },
  skeletonRow: { minHeight: 60 },
});
