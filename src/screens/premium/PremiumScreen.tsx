import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import {
  ChevronRight,
  CircleHelp,
  CloudOff,
  Crown,
  Ellipsis,
  Heart,
  Inbox,
  Infinity as InfinityIcon,
  Lock,
  Mail,
  MailOpen,
  MessageCircle,
  MessageCircleHeart,
  Radar,
  Send,
  ShieldCheck,
  VenetianMask,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CrushSection } from '@/components/secret/CrushSection';
import { PremiumPermissionsSheet } from '@/components/secret/PremiumPermissionsSheet';
import { useSecretSafety } from '@/components/secret/SecretSafety';
import {
  AvatarBadge,
  GhostAvatar,
  GhostName,
  LockCard,
  MiniTrack,
  NearbyChip,
  PlanPill,
  Tile,
} from '@/components/secret/SecretUI';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCrushActions } from '@/features/crush/useCrushActions';
import { queryClient } from '@/features/entities/entityCache';
import {
  getPermissionState,
  isUsable,
} from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { dayLabel, shortDate } from '@/features/secret/format';
import {
  refreshSecret,
  secretKeys,
  useNearbySettings,
  usePlans,
  useSecretInbox,
  useSecretSent,
  useSecretSummary,
  useSubscription,
} from '@/features/secret/secretQueries';
import { useStartSecret } from '@/features/secret/useStartSecret';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import type { NearbySettings } from '@/services/api/nearby';
import type {
  ReceivedThread,
  SentThread,
} from '@/services/api/secretMessages';
import { radius, spacing, useAppTheme } from '@/theme';

export const RECEIVED_NOTICE =
  'Someone is trying to reach you with a Secret Message 💌';

type Seg = 'received' | 'sent';
const FILTERS = {
  received: [
    ['all', 'All'],
    ['new', 'New'],
    ['sealed', 'Sealed'],
    ['revealed', 'Revealed'],
  ],
  sent: [
    ['all', 'All'],
    ['waiting', 'Waiting'],
    ['revealed', 'Revealed'],
  ],
} as const;
type ReceivedFilter = (typeof FILTERS.received)[number][0];
type SentFilter = (typeof FILTERS.sent)[number][0];

const RECEIVED_PASS: Record<ReceivedFilter, (t: ReceivedThread) => boolean> = {
  all: () => true,
  new: t => t.status === 'sealed' && t.has_unread,
  sealed: t => t.status === 'sealed',
  revealed: t => t.status === 'revealed',
};
const SENT_PASS: Record<SentFilter, (t: SentThread) => boolean> = {
  all: () => true,
  waiting: t => t.status === 'sealed',
  revealed: t => t.status === 'revealed',
};

const normQ = (q: string) => q.trim().toLowerCase().replace(/^@/, '');
const matchUser = (
  u: { username: string; display_name: string } | null | undefined,
  q: string,
) =>
  !!u &&
  (u.display_name.toLowerCase().includes(q) ||
    u.username.toLowerCase().includes(q));

/** One permission popup per app session, the first time Premium opens with something missing. */
let permissionsPromptShown = false;

function missingSetup(nearby: NearbySettings | undefined) {
  const notif = getPermissionState('notifications').status;
  const loc = getPermissionState('location').status;
  const missingPerm = (s: typeof notif) =>
    s !== undefined && s !== 'unavailable' && !isUsable(s);
  return (
    missingPerm(notif) ||
    missingPerm(loc) ||
    (!!nearby && nearby.feature_available && !nearby.enabled)
  );
}

export function PremiumScreen({ navigation, route }: TabScreenProps<'Premium'>) {
  const { colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  useStatusBar();

  const subQ = useSubscription();
  const plan = subQ.data?.plan ?? 'free';
  const paid = plan !== 'free';
  const summaryQ = useSecretSummary();
  const summary = summaryQ.data;
  const canRead = summary?.can_read ?? subQ.data?.limits.read_secret ?? false;
  const inboxQ = useSecretInbox(canRead);
  const sentQ = useSecretSent();
  const plusMonthly = usePlans().data?.data.find(p => p.id === 'plus')?.pricing
    .monthly.amount_paise;
  const plusPrice = plusMonthly ? Math.round(plusMonthly / 100) : null;
  const nearbyQ = useNearbySettings();
  const notif = usePermission('notifications');
  const loc = usePermission('location');

  const section = route.params?.section;
  const [tab, setTab] = useState<'messages' | 'crush'>(section ?? 'messages');
  useEffect(() => {
    if (section) setTab(section);
  }, [section]);
  const crush = useCrushActions();
  const [seg, setSeg] = useState<Seg>('received');
  const [query, setQuery] = useState({ received: '', sent: '' });
  const [rFilter, setRFilter] = useState<ReceivedFilter>('all');
  const [sFilter, setSFilter] = useState<SentFilter>('all');
  const [howOpen, setHowOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const start = useStartSecret();
  const safety = useSecretSafety();

  useFocusEffect(
    useCallback(() => {
      refreshSecret().catch(() => {});
      if (permissionsPromptShown) return;
      const timer = setTimeout(() => {
        const nearby = queryClient.getQueryData<NearbySettings>(secretKeys.nearby);
        if (permissionsPromptShown || !missingSetup(nearby)) return;
        permissionsPromptShown = true;
        setPermsOpen(true);
      }, 900);
      return () => clearTimeout(timer);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshSecret(),
      queryClient.invalidateQueries({ queryKey: secretKeys.subscription }),
      queryClient.invalidateQueries({ queryKey: secretKeys.nearby }),
      notif.check(),
      loc.check(),
    ]).catch(() => {});
    setRefreshing(false);
  };

  const received = useMemo(() => inboxQ.data?.data ?? [], [inboxQ.data]);
  const sent = useMemo(() => sentQ.data?.data ?? [], [sentQ.data]);
  const unread = summary?.unread_count ?? 0;
  const receivedCount = canRead
    ? received.length
    : summary?.received_count ?? 0;

  const nearby = nearbyQ.data;
  const setupMissing =
    !isUsable(notif.status) ||
    !isUsable(loc.status) ||
    (!!nearby && nearby.feature_available && !nearby.enabled);

  const goPlans = (reason?: 'secret-read' | 'secret-send' | 'limit' | 'nearby' | 'crush') =>
    navigation.navigate('Plans', reason ? { reason } : undefined);

  /* ---------- Rows ---------- */

  const sealedRow = (t: ReceivedThread) => {
    const used = t.replies_used;
    const status =
      used === 0 ? 'Sealed · reply twice to unseal' : 'One more reply unseals it';
    return (
      <Pressable
        key={t.id}
        onPress={() => navigation.navigate('SecretThread', { threadId: t.id })}
        accessibilityRole="button"
        accessibilityLabel={`Sealed message from ${dayLabel(t.day)}. ${status}`}
        style={({ pressed }) => [
          styles.row,
          t.has_unread && { backgroundColor: colors.primarySofter },
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <GhostAvatar size={52} badge="lock" />
        <View style={styles.rowBody}>
          <GhostName />
          <Text
            style={[
              styles.rowSub,
              { color: used === 1 ? colors.primary : colors.textSecondary },
              used === 1 && styles.bold,
            ]}
            numberOfLines={1}
          >
            {status}
          </Text>
          <MiniTrack count={used} />
          <NearbyChip hint={t.nearby_hint} />
        </View>
        <View style={styles.rowSide}>
          <Text style={[styles.day, { color: colors.textSecondary }]}>
            {dayLabel(t.day)}
          </Text>
          {t.has_unread ? (
            <View style={[styles.newTag, { backgroundColor: colors.button }]}>
              <Text style={[styles.newText, { color: colors.onButton }]}>New</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const revealedRow = (t: ReceivedThread) => {
    const u = t.sender;
    return (
      <Pressable
        key={t.id}
        onPress={() =>
          t.conversation_id
            ? navigation.navigate('ChatThread', { conversationId: t.conversation_id })
            : navigation.navigate('SecretThread', { threadId: t.id })
        }
        accessibilityRole="button"
        accessibilityLabel={`Revealed: ${u?.display_name ?? 'sender'}. Open chat.`}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <View>
          <Avatar uri={u?.avatar_url} name={u?.display_name ?? '?'} size={52} />
          <AvatarBadge kind="check" />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {u?.display_name ?? 'Nexity user'}
          </Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            Unsealed · now a chat
          </Text>
          <NearbyChip hint={t.nearby_hint} />
        </View>
        <View style={[styles.okChip, { backgroundColor: colors.successSoft }]}>
          <Text style={[styles.okText, { color: colors.success }]}>✓ Revealed</Text>
        </View>
      </Pressable>
    );
  };

  const lockedRow = (item: { id: string; day: string }) => (
    <View key={item.id} style={styles.row}>
      <Pressable
        onPress={() => goPlans('secret-read')}
        accessibilityRole="button"
        accessibilityLabel={`Sealed message from ${dayLabel(item.day)}. Upgrade to open.`}
        style={styles.lockedMain}
      >
        <GhostAvatar size={52} badge="lock" />
        <View style={styles.rowBody}>
          <GhostName />
          <View style={styles.inline}>
            <Lock size={11} color={colors.textSecondary} />
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
              Locked · {dayLabel(item.day)}
            </Text>
          </View>
        </View>
      </Pressable>
      <IconButton
        onPress={() => safety.open(item.id)}
        accessibilityLabel="Options"
        size={36}
      >
        <Ellipsis size={20} color={colors.textSecondary} />
      </IconButton>
    </View>
  );

  const sentRow = (t: SentThread) => {
    const u = t.recipient;
    const revealed = t.status === 'revealed';
    const status = revealed
      ? "They replied twice · you're revealed"
      : t.replies_received
      ? `${t.replies_received} of 2 replies · you're still hidden`
      : "Delivered · you're hidden";
    return (
      <Pressable
        key={t.id}
        onPress={() =>
          revealed && t.conversation_id
            ? navigation.navigate('ChatThread', { conversationId: t.conversation_id })
            : navigation.navigate('SecretThread', { threadId: t.id })
        }
        accessibilityRole="button"
        accessibilityLabel={`To ${u?.display_name ?? 'someone'}. ${status}`}
        style={({ pressed }) => [
          styles.row,
          t.has_unread && { backgroundColor: colors.primarySofter },
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <View>
          <Avatar uri={u?.avatar_url} name={u?.display_name ?? '?'} size={52} />
          <AvatarBadge kind={revealed ? 'check' : 'mask'} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            To {u?.display_name ?? 'Nexity user'}
          </Text>
          <Text
            style={[
              styles.rowSub,
              {
                color:
                  t.replies_received === 1 && !revealed
                    ? colors.primary
                    : colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {status}
          </Text>
          {revealed ? null : <MiniTrack count={t.replies_received} />}
          <NearbyChip hint={t.nearby_hint} />
        </View>
        <View style={styles.rowSide}>
          <Text style={[styles.day, { color: colors.textSecondary }]}>
            {dayLabel(t.day)}
          </Text>
          {revealed ? (
            <View style={[styles.okChip, { backgroundColor: colors.successSoft }]}>
              <MessageCircle size={12} color={colors.success} />
              <Text style={[styles.okText, { color: colors.success }]}>Chat</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  /* ---------- Sections ---------- */

  const tools = (which: Seg, counts: Record<string, number>) => (
    <View style={styles.tools}>
      <SearchField
        value={query[which]}
        onChange={text => setQuery(q => ({ ...q, [which]: text }))}
        placeholder="Search by name or username"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityRole="radiogroup"
      >
        {FILTERS[which].map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            active={which === 'received' ? rFilter === id : sFilter === id}
            count={id === 'all' ? 0 : counts[id] ?? 0}
            onPress={() =>
              which === 'received'
                ? setRFilter(id as ReceivedFilter)
                : setSFilter(id as SentFilter)
            }
          />
        ))}
      </ScrollView>
    </View>
  );

  const skeleton = (
    <View style={styles.list}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.row}>
          <SkeletonLoader variant="circle" size={52} />
          <View style={styles.rowBody}>
            <SkeletonLoader variant="line" width="55%" height={12} />
            <SkeletonLoader variant="line" width="80%" height={10} style={styles.mt6} />
          </View>
        </View>
      ))}
    </View>
  );

  const loadError = (retry: () => void) => (
    <EmptyState
      icon={<CloudOff size={34} color={colors.primary} />}
      title="Couldn't load messages"
      text="Check your connection and try again."
      actionLabel="Try again"
      onAction={retry}
    />
  );

  const emptyLine = (text: string) => (
    <Text style={[styles.emptyLine, { color: colors.textSecondary }]}>{text}</Text>
  );

  function receivedSection() {
    if (!summary && summaryQ.isPending) return skeleton;
    if (!summary && summaryQ.isError) return loadError(() => summaryQ.refetch());
    if (!canRead) {
      const locked = summary?.locked_items ?? [];
      if (!locked.length) {
        return (
          <LockCard
            icon={<MailOpen size={22} color={colors.primary} />}
            title="Read & reply to Secret Messages"
            points={[
              'Open sealed messages people send you',
              'Reply twice to unseal who sent it and what they wrote',
              'Blocking and reporting stay free',
            ]}
            priceFrom={plusPrice}
            onChoose={() => goPlans('secret-read')}
          />
        );
      }
      return (
        <>
          <View
            style={[
              styles.lockedBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Tile
              size={56}
              badge={<Lock size={10} color={colors.onButton} strokeWidth={2.6} />}
            >
              <Mail size={26} color={colors.primary} />
            </Tile>
            <Text style={[styles.lockedTitle, { color: colors.text }]}>
              You have {locked.length} sealed message{locked.length === 1 ? '' : 's'}
            </Text>
            <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
              Someone has something to tell you. Upgrade to reply — the name and
              message unseal after your 2nd reply.
            </Text>
            <Button
              title="Unlock Secret Messages"
              onPress={() => goPlans('secret-read')}
              style={styles.stretch}
            />
          </View>
          <View style={styles.head}>
            <Text style={[styles.headTitle, { color: colors.text }]}>
              Sealed messages
            </Text>
            <Text style={[styles.headCount, { color: colors.textSecondary }]}>
              {locked.length}
            </Text>
          </View>
          <View style={styles.list}>{locked.map(lockedRow)}</View>
        </>
      );
    }
    if (inboxQ.isPending) return skeleton;
    if (inboxQ.isError && !inboxQ.data) return loadError(() => inboxQ.refetch());
    if (!received.length) {
      return (
        <EmptyState
          icon={<Mail size={34} color={colors.primary} />}
          title="No secret messages yet"
          text="When someone sends you a Secret Message it lands here, sealed. Reply twice to unseal who sent it and what they wrote."
          actionLabel="Send a Secret Message"
          onAction={start.openPicker}
        />
      );
    }
    const q = normQ(query.received);
    let rows = received.filter(RECEIVED_PASS[rFilter]);
    const sealedSkipped = q ? rows.filter(t => t.status === 'sealed').length : 0;
    if (q) rows = rows.filter(t => t.status === 'revealed' && matchUser(t.sender, q));
    const counts = {
      new: received.filter(RECEIVED_PASS.new).length,
      sealed: received.filter(RECEIVED_PASS.sealed).length,
      revealed: received.filter(RECEIVED_PASS.revealed).length,
    };
    return (
      <>
        {tools('received', counts)}
        <View style={styles.inline}>
          <ShieldCheck size={15} color={colors.success} />
          <Text style={[styles.privacy, { color: colors.textSecondary }]}>
            Name and photo stay hidden until you reply twice.
          </Text>
        </View>
        {sealedSkipped ? (
          <View style={[styles.inline, styles.mt6]}>
            <Lock size={13} color={colors.textSecondary} />
            <Text style={[styles.privacy, { color: colors.textSecondary }]}>
              Sealed messages can't be searched by name until they're revealed.
            </Text>
          </View>
        ) : null}
        {rows.length ? (
          <View style={styles.list}>
            {rows.map(t => (t.status === 'revealed' ? revealedRow(t) : sealedRow(t)))}
          </View>
        ) : (
          emptyLine(q ? `No revealed messages match "${query.received.trim()}".` : 'No messages here yet.')
        )}
      </>
    );
  }

  const usageCard = () => {
    const usage = subQ.data?.usage;
    if (!usage) return null;
    const limit = usage.secret_messages_limit;
    if (limit === null) {
      return (
        <View
          style={[styles.usage, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Tile size={40}>
            <InfinityIcon size={22} color={colors.primary} />
          </Tile>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Unlimited Secret Messages with Premium
            </Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
              Fair use: up to 30 new a day
            </Text>
          </View>
        </View>
      );
    }
    const left = usage.secret_messages_left ?? 0;
    return (
      <View
        style={[styles.usage, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Tile size={40}>
          <Send size={20} color={colors.primary} />
        </Tile>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            {left} of {limit} Secret Messages left this month
          </Text>
          <View style={styles.pips} accessibilityElementsHidden>
            {Array.from({ length: limit }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.pip,
                  { backgroundColor: i < left ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            Resets {shortDate(usage.month_resets_at)}
          </Text>
        </View>
        {left === 0 ? (
          <Button title="Get more" onPress={() => goPlans('limit')} style={styles.small} />
        ) : null}
      </View>
    );
  };

  function sentSection() {
    const canSend = start.canSend;
    const head = canSend ? (
      usageCard()
    ) : (
      <LockCard
        icon={<Send size={22} color={colors.primary} />}
        title="Send Secret Messages"
        points={[
          'They only see "Someone sent you a secret message"',
          "You're revealed only after they reply twice",
          'Plus: 5 a month · Premium: unlimited',
        ]}
        priceFrom={plusPrice}
        onChoose={() => goPlans('secret-send')}
      />
    );
    if (sentQ.isPending) {
      return (
        <>
          {head}
          {skeleton}
        </>
      );
    }
    if (sentQ.isError && !sentQ.data) {
      return (
        <>
          {head}
          {loadError(() => sentQ.refetch())}
        </>
      );
    }
    if (!sent.length) {
      return (
        <>
          {head}
          {canSend ? (
            <EmptyState
              icon={<Send size={34} color={colors.primary} />}
              title="Nothing sent yet"
              text="Pick someone and tell them what you've been holding back. They'll only learn it's you after they reply twice."
              actionLabel="Send a Secret Message"
              onAction={start.openPicker}
            />
          ) : null}
        </>
      );
    }
    const q = normQ(query.sent);
    const rows = sent.filter(SENT_PASS[sFilter]).filter(t => !q || matchUser(t.recipient, q));
    const counts = {
      waiting: sent.filter(SENT_PASS.waiting).length,
      revealed: sent.filter(SENT_PASS.revealed).length,
    };
    return (
      <>
        {head}
        {tools('sent', counts)}
        {rows.length ? (
          <View style={styles.list}>{rows.map(sentRow)}</View>
        ) : (
          emptyLine(q ? `No one matches "${query.sent.trim()}".` : 'No messages here yet.')
        )}
        {canSend ? (
          <Button
            title="Send another Secret Message"
            onPress={start.openPicker}
            style={styles.stretch}
          />
        ) : null}
      </>
    );
  }

  const segButton = (id: Seg, label: string, Icon: typeof Inbox, n: number) => {
    const on = seg === id;
    return (
      <Pressable
        onPress={() => setSeg(id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[
          styles.segBtn,
          on && { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Icon size={16} color={on ? colors.text : colors.textSecondary} />
        <Text style={[styles.segText, { color: on ? colors.text : colors.textSecondary }]}>
          {label}
        </Text>
        {n ? (
          <View style={[styles.segN, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.segNText, { color: colors.primary }]}>{n}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const tabButton = (
    id: 'messages' | 'crush',
    label: string,
    Icon: typeof Heart,
    badge: number,
  ) => {
    const on = tab === id;
    return (
      <Pressable
        onPress={() => setTab(id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[styles.tab, { borderBottomColor: on ? colors.primary : 'transparent' }]}
      >
        <Icon size={18} color={on ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: on ? colors.text : colors.textSecondary }]}>
          {label}
        </Text>
        {!paid ? <Lock size={13} color={colors.textSecondary} /> : null}
        {badge ? (
          <View style={[styles.count, { backgroundColor: colors.accent }]}>
            <Text style={[styles.countText, { color: colors.onButton }]}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
        title="Premium"
        actions={
          <>
            <PlanPill plan={plan} onPress={() => goPlans()} />
            <IconButton onPress={() => setHowOpen(true)} accessibilityLabel="How it works">
              <CircleHelp size={22} color={colors.text} />
            </IconButton>
          </>
        }
      />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.intro}>
          <Tile size={48}>
            <VenetianMask size={24} color={colors.primary} />
          </Tile>
          <View style={styles.rowBody}>
            <Text style={[styles.introTitle, { color: colors.text }]}>
              Say it without saying who
            </Text>
            <Text style={[styles.introText, { color: colors.textSecondary }]}>
              Send secret messages and add secret crushes. Your name stays hidden.
            </Text>
          </View>
        </View>

        {!paid ? (
          <Pressable
            onPress={() => goPlans(tab === 'messages' ? 'secret-read' : 'crush')}
            accessibilityRole="button"
            style={[styles.gate, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Tile size={36} muted>
              <Lock size={18} color={colors.textSecondary} />
            </Tile>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Premium features need a plan
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                You're on Free{plusPrice ? ` · Plus from ₹${plusPrice}/month` : ''}
              </Text>
            </View>
            <Text style={[styles.gateCta, { color: colors.primary }]}>See plans</Text>
            <ChevronRight size={16} color={colors.primary} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            setupMissing ? setPermsOpen(true) : navigation.navigate('NearbySettings')
          }
          accessibilityRole="button"
          style={[styles.gate, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Tile size={36}>
            <Radar size={18} color={colors.primary} />
          </Tile>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {nearby?.enabled ? 'Nearby is on' : 'Nearby is off'}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {setupMissing
                ? 'Allow notifications and location to see who was near you.'
                : 'See "This person was near you today" on Secret Messages and Crushes.'}
            </Text>
          </View>
          <Text style={[styles.gateCta, { color: colors.primary }]}>
            {setupMissing ? 'Set up' : 'Manage'}
          </Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>

        <View style={[styles.tabs, { borderBottomColor: colors.border }]} accessibilityRole="tablist">
          {tabButton('messages', 'Messages', MessageCircleHeart, unread)}
          {tabButton('crush', 'Secret Crush', Heart, 0)}
        </View>

        {tab === 'messages' ? (
          <>
            <View
              style={[styles.seg, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="tablist"
            >
              {segButton('received', 'Received', Inbox, receivedCount)}
              {segButton('sent', 'Sent', Send, sent.length)}
            </View>
            <View style={styles.section}>
              {seg === 'received' ? receivedSection() : sentSection()}
            </View>
          </>
        ) : (
          <CrushSection actions={crush} priceFrom={plusPrice} />
        )}
      </ScrollView>

      <BottomSheet visible={howOpen} onClose={() => setHowOpen(false)}>
        <View style={styles.how}>
          <Text style={[styles.howTitle, { color: colors.text }]} accessibilityRole="header">
            How it works
          </Text>
          <View style={styles.howBlock}>
            <Tile size={40}>
              <MessageCircleHeart size={20} color={colors.primary} />
            </Tile>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Secret Messages</Text>
              {[
                `Send a message to anyone. They're told "${RECEIVED_NOTICE}".`,
                "The sender's name and message stay sealed while they reply.",
                'After their 2nd reply, the name, photo and full message unseal together and it becomes a normal chat.',
              ].map((line, i) => (
                <Text key={line} style={[styles.howLine, { color: colors.textSecondary }]}>
                  {i + 1}. {line}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.howBlock}>
            <Tile size={40}>
              <Heart size={20} color={colors.primary} />
            </Tile>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Secret Crush</Text>
              {[
                'Add people you like to your private crush list.',
                'They\'re told "Someone added you as a Secret Crush 👀" — never who.',
                "If they add you too, it's a match: you both see it and a love chat opens. If not, nobody ever finds out.",
              ].map((line, i) => (
                <Text key={line} style={[styles.howLine, { color: colors.textSecondary }]}>
                  {i + 1}. {line}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.howBlock}>
            <Tile size={40}>
              <Crown size={20} color={colors.primary} />
            </Tile>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Plans</Text>
              <Text style={[styles.howLine, { color: colors.textSecondary }]}>
                Opening, replying to and sending Secret Messages, and adding Secret Crushes
                (Plus: 3, Premium: 10), need a plan. Reporting and blocking are always free.
              </Text>
            </View>
          </View>
          <Button title="Got it" onPress={() => setHowOpen(false)} style={styles.stretch} />
        </View>
      </BottomSheet>

      <PremiumPermissionsSheet visible={permsOpen} onClose={() => setPermsOpen(false)} />
      {safety.element}
      {start.limitDialog}
      {crush.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: 12 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  mt6: { marginTop: 6 },
  stretch: { alignSelf: 'stretch', marginTop: 8 },
  small: { minHeight: 34, paddingHorizontal: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  introTitle: { fontSize: 17, fontWeight: '800' },
  introText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  gate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  gateCta: { fontSize: 13, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 14.5, fontWeight: '800' },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '800' },
  seg: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segText: { fontSize: 14, fontWeight: '700' },
  segN: { borderRadius: 9, paddingHorizontal: 6, minWidth: 18, alignItems: 'center' },
  segNText: { fontSize: 11.5, fontWeight: '800' },
  section: { gap: 12 },
  tools: { gap: 10 },
  filters: { gap: 8, paddingRight: spacing.md },
  privacy: { fontSize: 12.5, flexShrink: 1 },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  lockedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowSide: { alignItems: 'flex-end', gap: 6 },
  day: { fontSize: 12 },
  newTag: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  newText: { fontSize: 11, fontWeight: '800' },
  okChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  okText: { fontSize: 11.5, fontWeight: '800' },
  lockedBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 8,
  },
  lockedTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  lockedText: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontSize: 15, fontWeight: '800' },
  headCount: { fontSize: 13, fontWeight: '700' },
  usage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  pips: { flexDirection: 'row', gap: 4, marginTop: 6 },
  pip: { flex: 1, maxWidth: 28, height: 5, borderRadius: 3 },
  emptyLine: { fontSize: 13.5, textAlign: 'center', paddingVertical: spacing.lg },
  how: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 14 },
  howTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  howBlock: { flexDirection: 'row', gap: 12 },
  howLine: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
});
