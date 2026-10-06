import {
  Bell,
  Heart,
  type LucideIcon,
  MessageCircle,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { NotificationListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  type AppNotification,
  markNotificationsRead,
  type NotificationType,
  refreshNotifications,
  useNotifications,
} from '@/features/notifications/useNotifications';
import { focusReelId } from '@/features/reels/reelFocus';
import type { RootStackParamList } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, type ThemeColors, useAppTheme } from '@/theme';
import { DAY, timeAgoLong } from '@/utils/time';

type Filter =
  | 'all'
  | 'chat'
  | 'like'
  | 'secret'
  | 'crush'
  | 'match'
  | 'subscription';

const FILTERS: readonly { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chat', label: 'Chat' },
  { key: 'like', label: 'Likes' },
  { key: 'secret', label: 'Secret Message' },
  { key: 'crush', label: 'Secret Crush' },
  { key: 'match', label: 'Match' },
  { key: 'subscription', label: 'Subscription' },
];

/** Comments are grouped under Likes, like the prototype. */
function matchesFilter(type: NotificationType, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'like') return type === 'like' || type === 'comment';
  return type === filter;
}

export function NotificationsScreen() {
  const { colors } = useAppTheme();
  const { items, loaded } = useNotifications();
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const requestCount = user?.follow_requests_count ?? 0;
  const [filter, setFilter] = useState<Filter>('all');
  useStatusBar();

  useFocusEffect(
    useCallback(() => {
      refreshUser().catch(() => {});
      refreshNotifications()
        .then(() => markNotificationsRead())
        .catch(() => {});
    }, [refreshUser]),
  );

  const unreadByFilter = useMemo(() => {
    const counts = {} as Record<Filter, number>;
    for (const f of FILTERS) {
      counts[f.key] = items.filter(
        n => !n.read && matchesFilter(n.type, f.key),
      ).length;
    }
    return counts;
  }, [items]);

  const sections = useMemo(() => {
    const now = Date.now();
    const list = items.filter(n => matchesFilter(n.type, filter));
    const today = list.filter(n => now - n.createdAt < DAY);
    const earlier = list.filter(n => now - n.createdAt >= DAY);
    return [
      { title: 'Today', data: today },
      { title: 'Earlier', data: earlier },
    ].filter(s => s.data.length > 0);
  }, [items, filter]);

  const activeLabel = FILTERS.find(f => f.key === filter)?.label ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Notifications" back />
      <SectionList
        sections={sections}
        keyExtractor={n => n.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              accessibilityRole="tablist"
            >
              {FILTERS.map(f => (
                <Chip
                  key={f.key}
                  label={f.label}
                  active={filter === f.key}
                  count={unreadByFilter[f.key]}
                  onPress={() => setFilter(f.key)}
                />
              ))}
            </ScrollView>
            {requestCount > 0 ? (
              <Pressable
                onPress={() => navigation.navigate('FollowRequests')}
                accessibilityRole="button"
                accessibilityLabel={`Follow requests, ${requestCount} pending`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <View
                  style={[
                    styles.badgeLead,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <UserPlus size={22} color={colors.primary} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.requestTitle, { color: colors.text }]}>
                    Follow requests
                  </Text>
                  <Text style={[styles.time, { color: colors.textSecondary }]}>
                    Approve or ignore requests
                  </Text>
                </View>
                <Text style={[styles.requestCount, { color: colors.primary }]}>
                  {requestCount}
                </Text>
                <View
                  style={[
                    styles.unreadDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
              </Pressable>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={[styles.groupTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => <NotificationRow item={item} />}
        ListEmptyComponent={
          !loaded ? (
            <NotificationListSkeleton />
          ) : (
          <EmptyState
            icon={<Bell size={34} color={colors.primary} />}
            title={
              filter === 'all'
                ? 'No notifications yet'
                : `No ${activeLabel} notifications`
            }
            text="When something happens, you'll see it here."
          />
          )
        }
      />
    </SafeAreaView>
  );
}

type Lead = { emoji?: string; Icon?: LucideIcon; bg: string; fg: string };

function leadFor(type: NotificationType, colors: ThemeColors): Lead {
  switch (type) {
    case 'secret':
      return { emoji: '💌', bg: '#1F3C99', fg: '#FFFFFF' };
    case 'crush':
      return { emoji: '👀', bg: '#FFE1EC', fg: '#FFFFFF' };
    case 'match':
      return { emoji: '💘', bg: colors.accent, fg: '#FFFFFF' };
    case 'like':
      return { Icon: Heart, bg: colors.like, fg: '#FFFFFF' };
    case 'comment':
      return { Icon: MessageCircle, bg: colors.like, fg: '#FFFFFF' };
    case 'chat':
      return { Icon: MessageCircle, bg: colors.primary, fg: '#FFFFFF' };
    case 'follow':
      return { Icon: UserPlus, bg: colors.primary, fg: '#FFFFFF' };
    case 'subscription':
      return { Icon: Sparkles, bg: colors.primarySoft, fg: colors.primary };
  }
}

function NotificationRow({ item }: { item: AppNotification }) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const lead = leadFor(item.type, colors);
  const open = () => {
    if (item.postId) navigation.navigate('PostDetail', { postId: item.postId });
    else if (item.reelId) {
      focusReelId(item.reelId);
      navigation.popTo('Main', { screen: 'Reels' });
    }
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.text}`}
      style={({ pressed }) => [
        styles.row,
        !item.read && { backgroundColor: colors.primarySofter },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      {item.type === 'crush' || !item.actor ? (
        <View style={[styles.badgeLead, { backgroundColor: lead.bg }]}>
          {lead.emoji ? (
            <Text style={styles.badgeEmoji}>{lead.emoji}</Text>
          ) : lead.Icon ? (
            <lead.Icon size={20} color={lead.fg} />
          ) : null}
        </View>
      ) : (
        <View>
          <Avatar
            uri={item.actor.avatar_url}
            name={item.actor.display_name}
            size={46}
          />
          <View
            style={[
              styles.typeDot,
              { backgroundColor: lead.bg, borderColor: colors.background },
            ]}
          >
            {lead.emoji ? (
              <Text style={styles.typeEmoji}>{lead.emoji}</Text>
            ) : lead.Icon ? (
              <lead.Icon size={11} color={lead.fg} strokeWidth={2.6} />
            ) : null}
          </View>
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {timeAgoLong(item.createdAt)}
        </Text>
      </View>
      {!item.read ? (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
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
  chips: {
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingTop: 4,
    paddingBottom: 12,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  badgeLead: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 22 },
  typeDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeEmoji: { fontSize: 10 },
  body: { flex: 1, minWidth: 0 },
  text: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, marginTop: 2 },
  requestTitle: { fontSize: 14.5, fontWeight: '700' },
  requestCount: { fontSize: 14, fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
});
