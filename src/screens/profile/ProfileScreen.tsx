import { useFocusEffect } from '@react-navigation/native';
import {
  Bookmark,
  Camera,
  ChevronRight,
  Clapperboard,
  Grid3x3,
  Lock,
  Settings,
  SquarePlus,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPreview } from '@/components/profile/AvatarPreview';
import {
  Stat,
  TabBar,
  TabButton,
  WebsiteLink,
} from '@/components/profile/ProfileParts';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button, LinkButton } from '@/components/ui/Button';
import { PostGrid } from '@/components/posts/PostGrid';
import { ReelGrid } from '@/components/reels/ReelGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileLink } from '@/features/profile/schemas';
import { postsApi } from '@/services/api/posts';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

type ProfileTab = 'posts' | 'reels' | 'saved';

export function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { user, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  useStatusBar();
  const fetchSaved = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.saved(cursor, signal),
    [],
  );
  const fetchPosts = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.byUser(user?.id ?? '', cursor, signal),
    [user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      // Keeps counts current; the cached profile stays on screen when offline.
      refreshUser().catch(() => {});
    }, [refreshUser]),
  );

  if (!user) return null;

  const openCreate = () => navigation.navigate('Create');
  const openEdit = () => navigation.navigate('EditProfile');
  const openConnections = (initialTab: 'followers' | 'following') =>
    navigation.navigate('Followers', {
      userId: user.id,
      username: user.username,
      tab: initialTab,
    });
  const requests = user.follow_requests_count ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch {
      // Pull-to-refresh failing offline is expected; keep what is shown.
    } finally {
      setRefreshing(false);
    }
  };

  const shareProfile = () =>
    Share.share({
      message: `Follow @${user.username} on Nexity: ${profileLink(
        user.username,
      )}`,
    }).catch(() => {});

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
        back
        left={
          <View style={styles.titleRow}>
            {user.is_private ? (
              <Lock size={16} color={colors.text} strokeWidth={2.4} />
            ) : null}
            <Text
              style={[styles.username, { color: colors.text }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {user.username}
            </Text>
          </View>
        }
        actions={
          <>
            <IconButton onPress={openCreate} accessibilityLabel="Create">
              <SquarePlus size={24} color={colors.text} />
            </IconButton>
            <IconButton
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Settings"
            >
              <Settings size={24} color={colors.text} />
            </IconButton>
          </>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.head}>
          <View style={styles.top}>
            <Pressable
              onPress={() => setPhotoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="View profile photo"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Avatar
                uri={user.avatar_url}
                name={user.display_name}
                size={88}
              />
            </Pressable>
            <View style={styles.stats}>
              <Stat value={user.posts_count ?? 0} label="Posts" />
              <Stat
                value={user.followers_count ?? 0}
                label="Followers"
                onPress={() => openConnections('followers')}
              />
              <Stat
                value={user.following_count ?? 0}
                label="Following"
                onPress={() => openConnections('following')}
              />
            </View>
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]}>
              {user.display_name}
            </Text>
            {user.bio ? (
              <Text style={[styles.bio, { color: colors.text }]}>
                {user.bio}
              </Text>
            ) : (
              <View style={styles.addBio}>
                <LinkButton title="+ Add a bio" onPress={openEdit} />
              </View>
            )}
            {user.website ? <WebsiteLink url={user.website} /> : null}
          </View>
          <View style={styles.actions}>
            <Button
              title="Edit profile"
              variant="secondary"
              onPress={openEdit}
              style={styles.action}
            />
            <Button
              title="Share profile"
              variant="secondary"
              onPress={shareProfile}
              style={styles.action}
            />
          </View>
          {requests > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('FollowRequests')}
              accessibilityRole="button"
              accessibilityLabel={`Follow requests, ${requests}`}
              style={({ pressed }) => [
                styles.requests,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.requestsIcon,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <UserPlus size={18} color={colors.primary} />
              </View>
              <Text style={[styles.requestsText, { color: colors.text }]}>
                Follow requests
              </Text>
              <Text
                style={[
                  styles.requestsCount,
                  { color: colors.onButton, backgroundColor: colors.accent },
                ]}
              >
                {requests > 99 ? '99+' : requests}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <TabBar>
          <TabButton
            label="Posts"
            active={tab === 'posts'}
            onPress={() => setTab('posts')}
            Icon={Grid3x3}
          />
          <TabButton
            label="Reels"
            active={tab === 'reels'}
            onPress={() => setTab('reels')}
            Icon={Clapperboard}
          />
          <TabButton
            label="Saved"
            active={tab === 'saved'}
            onPress={() => setTab('saved')}
            Icon={Bookmark}
          />
        </TabBar>

        {tab === 'posts' ? (
          <PostGrid
            fetchPage={fetchPosts}
            from={{ source: 'user', userId: user.id }}
            empty={
              <EmptyState
                icon={<Camera size={34} color={colors.primary} />}
                title="Share your first photo"
                text="Your photos and moments will appear here."
                action={
                  <Button
                    title="Create a post"
                    onPress={openCreate}
                    style={styles.cta}
                  />
                }
              />
            }
          />
        ) : tab === 'saved' ? (
          <PostGrid
            fetchPage={fetchSaved}
            from={{ source: 'saved' }}
            empty={
              <EmptyState
                icon={<Bookmark size={34} color={colors.primary} />}
                title="No saved posts"
                text="Posts you save show up here."
              />
            }
          />
        ) : (
          <ReelGrid
            userId={user.id}
            empty={
              <EmptyState
                icon={<Clapperboard size={34} color={colors.primary} />}
                title="No reels yet"
                text="Reels you create will show up here."
                action={
                  <Button
                    title="Create a reel"
                    onPress={() => navigation.navigate('CreateReel')}
                    style={styles.cta}
                  />
                }
              />
            }
          />
        )}
      </ScrollView>
      <AvatarPreview
        visible={photoOpen}
        uri={user.avatar_url}
        name={user.display_name}
        onClose={() => setPhotoOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  head: { paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, flexDirection: 'row' },
  info: { marginTop: 14, marginBottom: 14 },
  name: { fontSize: 16, fontWeight: '700' },
  bio: { fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  addBio: { alignSelf: 'flex-start', marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: 14 },
  action: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
  pressed: { opacity: 0.7 },
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  requestsIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsText: { flex: 1, fontSize: 15, fontWeight: '700' },
  requestsCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '800',
  },
  cta: { minWidth: 200 },
});
