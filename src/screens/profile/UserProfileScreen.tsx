import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {
  Ban,
  Camera,
  Clapperboard,
  Flag,
  Grid3x3,
  Lock,
  MoreHorizontal,
  Share2,
  UserX,
  WifiOff,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { FollowButton } from '@/components/follows/FollowButton';
import { AvatarPreview } from '@/components/profile/AvatarPreview';
import {
  Stat,
  SwipeTabs,
  TabBar,
  TabButton,
  WebsiteLink,
} from '@/components/profile/ProfileParts';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { StoryAvatar } from '@/components/stories/StoryAvatar';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/posts/PostGrid';
import { ReelGrid } from '@/components/reels/ReelGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { chat } from '@/features/chats/chatController';
import { relationshipFromFollow } from '@/features/entities/entityCache';
import {
  primeFollowStatuses,
  useFollowStatus,
} from '@/features/follows/followStore';
import { profileLink } from '@/features/profile/schemas';
import { ApiError } from '@/services/api/client';
import { followsApi, type Profile } from '@/services/api/follows';
import { postsApi } from '@/services/api/posts';
import { safetyApi } from '@/services/api/safety';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

const USER_TABS = ['posts', 'reels'] as const;

type Load =
  | { state: 'loading' }
  | { state: 'ready'; profile: Profile }
  | { state: 'notFound' }
  | { state: 'error'; message: string };

export function UserProfileScreen({
  navigation,
  route,
}: ScreenProps<'UserProfile'>) {
  const username = route.params.username.toLowerCase();
  const { colors } = useAppTheme();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useStatusBar();

  const fetchProfile = useCallback(async () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      const profile = await followsApi.profile(username, c.signal);
      if (c.signal.aborted) return;
      if (profile.is_self) {
        navigation.replace('Profile');
        return;
      }
      primeFollowStatuses([profile]);
      setLoad({ state: 'ready', profile });
    } catch (err) {
      if (c.signal.aborted) return;
      if (err instanceof ApiError && err.status === 404) {
        setLoad({ state: 'notFound' });
      } else {
        setLoad(prev =>
          // A failed background refresh keeps the profile on screen.
          prev.state === 'ready'
            ? prev
            : {
                state: 'error',
                message:
                  err instanceof ApiError
                    ? err.message
                    : 'Something went wrong. Please try again.',
              },
        );
      }
    }
  }, [username, navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );
  useEffect(() => () => controller.current?.abort(), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const header = (
    <AppBar
      back
      title={username}
      actions={
        load.state === 'ready' ? <MoreMenu profile={load.profile} /> : undefined
      }
    />
  );

  if (load.state !== 'ready') {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        {header}
        {load.state === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : load.state === 'notFound' ? (
          <EmptyState
            icon={<UserX size={34} color={colors.primary} />}
            title="User not found"
            text="The link may be broken, or the account may have been removed."
          />
        ) : (
          <EmptyState
            icon={<WifiOff size={34} color={colors.primary} />}
            title="Couldn't load this profile"
            text={load.message}
            action={
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  setLoad({ state: 'loading' });
                  fetchProfile();
                }}
                style={styles.retry}
              />
            }
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      {header}
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
        <ProfileBody profile={load.profile} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [tab, setTab] = useState<(typeof USER_TABS)[number]>('posts');
  const [photoOpen, setPhotoOpen] = useState(false);
  const fetchPosts = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.byUser(profile?.id ?? '', cursor, signal),
    [profile?.id],
  );
  const [opening, setOpening] = useState(false);
  const status = useFollowStatus(profile.id, profile.follow_status);

  // The server counts are from the last fetch; reflect a follow made since.
  const delta =
    (status === 'accepted' ? 1 : 0) -
    (profile.follow_status === 'accepted' ? 1 : 0);
  const followers = Math.max(0, profile.followers_count + delta);
  const canView = !profile.is_private || status === 'accepted';

  const openConnections = canView
    ? (initialTab: 'followers' | 'following') =>
        navigation.navigate('Followers', {
          userId: profile.id,
          username: profile.username,
          tab: initialTab,
        })
    : undefined;

  // Opened from that same chat: go back to it instead of stacking a second copy.
  const message = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const conversationId = await chat.openDirect(profile.id);
      const routes = navigation.getState()?.routes ?? [];
      const previous = routes[routes.length - 2];
      if (
        previous?.name === 'ChatThread' &&
        (previous.params as { conversationId?: string } | undefined)
          ?.conversationId === conversationId
      ) {
        navigation.goBack();
      } else {
        navigation.dispatch(StackActions.push('ChatThread', { conversationId }));
      }
    } catch (err) {
      Alert.alert(
        "Couldn't open chat",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <View style={styles.head}>
        <View style={styles.top}>
          <StoryAvatar
            userId={profile.id}
            username={profile.username}
            avatarUrl={profile.avatar_url}
            name={profile.display_name}
            size={84}
            onShowPhoto={() => setPhotoOpen(true)}
          />
          <View style={styles.stats}>
            <Stat value={profile.posts_count} label="Posts" />
            <Stat
              value={followers}
              label="Followers"
              onPress={openConnections && (() => openConnections('followers'))}
            />
            <Stat
              value={profile.following_count}
              label="Following"
              onPress={openConnections && (() => openConnections('following'))}
            />
          </View>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]}>
              {profile.display_name}
            </Text>
            {profile.is_private ? (
              <Lock size={14} color={colors.textSecondary} strokeWidth={2.4} />
            ) : null}
          </View>
          {profile.bio ? (
            <Text style={[styles.bio, { color: colors.text }]}>
              {profile.bio}
            </Text>
          ) : null}
          {profile.website ? <WebsiteLink url={profile.website} /> : null}
          {profile.follows_you && status !== 'accepted' ? (
            <Text style={[styles.followsYou, { color: colors.textSecondary }]}>
              Follows you
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <FollowButton
            user={profile}
            relation={{
              relationship: relationshipFromFollow(profile.follow_status),
              follows_you: profile.follows_you,
              is_private: profile.is_private,
              muted: profile.muted ?? false,
            }}
            variant="full"
            onMessage={message}
            messageLoading={opening}
          />
        </View>
      </View>

      {canView ? (
        <>
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
          </TabBar>
          <SwipeTabs tabs={USER_TABS} value={tab} onChange={setTab}>
          {tab === 'posts' ? (
            <PostGrid
              fetchPage={fetchPosts}
              from={{ source: 'user', userId: profile.id }}
              empty={
                <EmptyState
                  icon={<Camera size={34} color={colors.primary} />}
                  title="No posts yet"
                  text={`When @${profile.username} shares photos, you'll see them here.`}
                />
              }
            />
          ) : (
            <ReelGrid
              userId={profile.id}
              empty={
                <EmptyState
                  icon={<Clapperboard size={34} color={colors.primary} />}
                  title="No reels yet"
                />
              }
            />
          )}
          </SwipeTabs>
        </>
      ) : (
        <View
          style={[
            styles.private,
            { borderTopColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <View style={[styles.lockArt, { borderColor: colors.text }]}>
            <Lock size={28} color={colors.text} />
          </View>
          <Text style={[styles.privateTitle, { color: colors.text }]}>
            This account is private
          </Text>
          <Text style={[styles.privateText, { color: colors.textSecondary }]}>
            {status === 'pending'
              ? 'Your request is waiting for approval.'
              : 'Follow this account to see their photos and videos.'}
          </Text>
        </View>
      )}

      <AvatarPreview
        visible={photoOpen}
        uri={profile.avatar_url}
        name={profile.display_name}
        onClose={() => setPhotoOpen(false)}
      />
    </>
  );
}

function MoreMenu({ profile }: { profile: Profile }) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const share = () =>
    Share.share({
      message: `See @${profile.username} on Nexity: ${profileLink(
        profile.username,
      )}`,
    }).catch(() => {});

  const block = () => {
    Alert.alert(
      `Block @${profile.username}?`,
      "They won't be able to find your profile, posts or stories.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyApi.block(profile.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert(
                "Couldn't block",
                err instanceof ApiError ? err.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <IconButton
        onPress={() => setOpen(true)}
        accessibilityLabel="More options"
      >
        <MoreHorizontal size={24} color={colors.text} />
      </IconButton>
      <ActionSheet
        visible={open}
        title={profile.username}
        onClose={() => setOpen(false)}
        options={[
          {
            label: 'Share profile',
            icon: <Share2 size={22} color={colors.text} />,
            onPress: share,
          },
          {
            label: 'Report',
            icon: <Flag size={22} color={colors.text} />,
            onPress: () => setReporting(true),
          },
          {
            label: 'Block',
            icon: <Ban size={22} color={colors.danger} />,
            destructive: true,
            onPress: block,
          },
        ]}
      />
      <ReportSheet
        visible={reporting}
        targetType="user"
        targetId={profile.id}
        blockUserId={profile.id}
        username={profile.username}
        onClose={() => setReporting(false)}
        onBlocked={() => navigation.goBack()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { marginTop: spacing.xl * 2 },
  retry: { minWidth: 180 },
  scroll: { paddingBottom: spacing.lg },
  head: { paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, flexDirection: 'row' },
  info: { marginTop: 14, marginBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700' },
  bio: { fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  followsYou: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: 14 },
  message: {
    flex: 1,
    height: 38,
    minHeight: 38,
    paddingVertical: 0,
    borderRadius: radius.sm,
  },
  private: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    borderRadius: radius.md,
  },
  lockArt: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  privateTitle: { fontSize: 16, fontWeight: '800' },
  privateText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
});
