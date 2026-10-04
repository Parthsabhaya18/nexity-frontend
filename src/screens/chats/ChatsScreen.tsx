import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  BellOff,
  CloudOff,
  MessageCircle,
  Search,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/chat/ActionSheet';
import { useToast } from '@/components/chat/Toast';
import { useNow } from '@/components/chat/useNow';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { chat as chatActions } from '@/features/chats/chatController';
import {
  type ChatSummary,
  inboxSubtitle,
  useChats,
} from '@/features/chats/useChats';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

export function ChatsScreen({ navigation }: ScreenProps<'Chats'>) {
  const { colors } = useAppTheme();
  const { chats, status, error } = useChats();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState<ChatSummary | null>(null);
  const { toast, show: showToast } = useToast();
  useNow();
  useStatusBar();

  useFocusEffect(
    useCallback(() => {
      chatActions.refreshPresence();
    }, []),
  );

  const menuActions: SheetAction[] = menuFor
    ? [
        {
          key: 'mute',
          label: menuFor.muted ? 'Unmute messages' : 'Mute messages',
          Icon: menuFor.muted ? Bell : BellOff,
          onPress: () =>
            chatActions
              .setMuted(menuFor.id, !menuFor.muted)
              .catch(() => showToast("Couldn't update. Try again.")),
        },
        {
          key: 'delete',
          label: 'Delete chat',
          Icon: Trash2,
          destructive: true,
          onPress: () =>
            Alert.alert(
              'Delete chat?',
              `This removes the chat with ${menuFor.peer.display_name} from your inbox. ${menuFor.peer.display_name} will still see it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    chatActions
                      .deleteForMe(menuFor.id)
                      .catch(() => showToast("Couldn't delete. Try again.")),
                },
              ],
            ),
        },
      ]
    : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await chatActions.refreshInbox();
    setRefreshing(false);
  }, []);

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

  const newMessage = () => navigation.navigate('NewMessage');
  const openChat = (id: string) =>
    navigation.navigate('ChatThread', { conversationId: id });

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
        onEndReached={() => chatActions.loadMoreInbox()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
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
        renderItem={({ item }) => (
          <ChatRow
            chat={item}
            onPress={() => openChat(item.id)}
            onLongPress={() => setMenuFor(item)}
          />
        )}
        ListEmptyComponent={
          status === 'idle' || status === 'loading' ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : status === 'error' ? (
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title="Couldn't load chats"
              text={error ?? 'Check your connection and try again.'}
              action={
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => chatActions.refreshInbox()}
                  style={styles.cta}
                />
              }
            />
          ) : q ? (
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
      {toast}
      <ActionSheet
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        actions={menuActions}
      />
    </SafeAreaView>
  );
}

function ChatRow({
  chat,
  onPress,
  onLongPress,
}: {
  chat: ChatSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useAppTheme();
  const unread = chat.unread > 0;
  const subtitle = inboxSubtitle(chat);
  const time =
    subtitle.showTime && chat.lastMessageAt ? timeAgo(chat.lastMessageAt) : null;
  const subtitleColor = unread ? colors.text : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      accessibilityRole="button"
      accessibilityHint="Long press for options"
      accessibilityLabel={`${chat.peer.display_name}. ${subtitle.text}${
        time ? `, ${time}` : ''
      }${chat.online && subtitle.text !== 'Active now' ? '. Active now' : ''}${
        chat.muted ? '. Muted' : ''
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
        online={chat.online}
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
        <View style={styles.subtitleRow}>
          <Text
            style={[
              styles.preview,
              { color: subtitleColor },
              unread && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {subtitle.text}
          </Text>
          {time ? (
            <Text
              style={[
                styles.time,
                { color: subtitleColor },
                unread && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {` · ${time}`}
            </Text>
          ) : null}
          {chat.muted ? (
            <BellOff
              size={13}
              color={colors.textSecondary}
              style={styles.mutedIcon}
            />
          ) : null}
        </View>
      </View>
      {unread ? (
        <View
          style={[
            styles.unreadDot,
            { backgroundColor: chat.muted ? colors.textSecondary : colors.primary },
          ]}
        />
      ) : null}
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
  subtitleRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  preview: { fontSize: 13.5, flexShrink: 1 },
  previewUnread: { fontWeight: '700' },
  time: { fontSize: 13.5, flexShrink: 0 },
  mutedIcon: { marginLeft: 6 },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 4 },
  cta: { minWidth: 200 },
  loader: { marginTop: 48 },
});
