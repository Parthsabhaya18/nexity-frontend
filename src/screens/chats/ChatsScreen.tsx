import { MessageCircle, Search, SquarePen, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { type ChatSummary, useChats } from '@/features/chats/useChats';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

export function ChatsScreen({ navigation }: ScreenProps<'Chats'>) {
  const { colors } = useAppTheme();
  const { chats } = useChats();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  useStatusBar();

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const sorted = [...chats].sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );
    if (!q) return sorted;
    return sorted.filter(
      c =>
        c.peer.display_name.toLowerCase().includes(q) ||
        c.peer.username.toLowerCase().includes(q),
    );
  }, [chats, q]);

  const newMessage = () => navigation.navigate('Main', { screen: 'Search' });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar
        title="Chats"
        back
        actions={
          <IconButton onPress={newMessage} accessibilityLabel="New message">
            <SquarePen size={23} color={colors.text} />
          </IconButton>
        }
      />
      <FlatList
        data={shown}
        keyExtractor={c => c.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: focused
                  ? colors.surface
                  : colors.inputBackground,
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
              placeholder="Search chats"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel="Search chats"
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
        }
        renderItem={({ item }) => <ChatRow chat={item} />}
        ListEmptyComponent={
          q ? (
            <EmptyState
              icon={<Search size={34} color={colors.primary} />}
              title="No chats found"
              text={`No conversations match "${query.trim()}".`}
            />
          ) : (
            <EmptyState
              icon={<MessageCircle size={34} color={colors.primary} />}
              title="No messages yet"
              text="Start a conversation with someone you follow, or match with a Secret Crush."
              action={
                <Button
                  title="New message"
                  onPress={newMessage}
                  style={styles.cta}
                />
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const { colors } = useAppTheme();
  const unread = chat.unread > 0;
  const preview = chat.lastMessage ?? 'Say hi 👋';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chat.peer.display_name}. ${preview}${
        unread ? `. ${chat.unread} unread` : ''
      }`}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <Avatar
        uri={chat.peer.avatar_url}
        name={chat.peer.display_name}
        size={54}
      />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text
            style={[
              styles.name,
              { color: colors.text },
              unread && styles.strong,
            ]}
            numberOfLines={1}
          >
            {chat.peer.display_name}
          </Text>
          {chat.kind === 'match' ? (
            <Text
              style={[
                styles.kindTag,
                { color: colors.accent, backgroundColor: `${colors.accent}26` },
              ]}
            >
              💘 Match
            </Text>
          ) : chat.kind === 'revealed' ? (
            <Text
              style={[
                styles.kindTag,
                { color: colors.primary, backgroundColor: colors.primarySoft },
              ]}
            >
              💌 Revealed
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.preview,
            { color: unread ? colors.text : colors.textSecondary },
            unread && styles.previewUnread,
          ]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      <View style={styles.meta}>
        {chat.lastMessageAt ? (
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {timeAgo(chat.lastMessageAt)}
          </Text>
        ) : null}
        {unread ? (
          <View style={[styles.count, { backgroundColor: colors.primary }]}>
            <Text style={styles.countText} allowFontScaling={false}>
              {chat.unread > 99 ? '99+' : chat.unread}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  searchBox: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    marginHorizontal: spacing.sm,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  strong: { fontWeight: '800' },
  kindTag: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  preview: { fontSize: 13.5 },
  previewUnread: { fontWeight: '600' },
  meta: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 12 },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cta: { minWidth: 200 },
});
