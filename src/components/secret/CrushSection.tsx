import { useNavigation } from '@react-navigation/native';
import { CloudOff, Eye, Heart, Pause, Plus, ShieldCheck, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCrushList, useCrushMatches, useCrushSummary } from '@/features/crush/crushQueries';
import type { useCrushActions } from '@/features/crush/useCrushActions';
import type { CrushItem, CrushMatch } from '@/services/api/secretCrush';
import { radius, spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

import { LockCard, NearbyChip, Tile } from './SecretUI';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const ago = (iso: string) => {
  const t = timeAgo(Date.parse(iso));
  return t === 'now' ? 'just now' : /\d[mhd]$/.test(t) ? `${t} ago` : t;
};

/** Premium → Secret Crush: admirers, matches, my private list and the add button. */
export function CrushSection({
  actions,
  priceFrom,
}: {
  actions: ReturnType<typeof useCrushActions>;
  priceFrom: number | null;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const summaryQ = useCrushSummary();
  const listQ = useCrushList();
  const matchesQ = useCrushMatches();
  const summary = summaryQ.data;
  const mine = listQ.data?.data ?? [];
  const matches = matchesQ.data?.data ?? [];
  const canAdd = actions.canAdd;
  const admirers = summary?.admirers_count ?? 0;

  if (!summary && summaryQ.isPending) {
    return (
      <View style={styles.gap}>
        <SkeletonLoader variant="line" width="100%" height={92} />
        {[0, 1].map(i => (
          <View key={i} style={styles.row}>
            <SkeletonLoader variant="circle" size={52} />
            <View style={styles.flex}>
              <SkeletonLoader variant="line" width="50%" height={12} />
              <SkeletonLoader variant="line" width="75%" height={10} style={styles.mt6} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (!summary && summaryQ.isError) {
    return (
      <EmptyState
        icon={<CloudOff size={34} color={colors.primary} />}
        title="Couldn't load Secret Crush"
        text="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => summaryQ.refetch()}
      />
    );
  }

  const received = (
    <View
      style={[styles.card, styles.admirers, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Tile size={46} muted={!admirers}>
        <Eye size={22} color={admirers ? colors.primary : colors.textSecondary} />
      </Tile>
      <View style={styles.flex}>
        {admirers ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              <Text style={styles.big}>{admirers}</Text>{' '}
              {admirers === 1 ? 'person has' : 'people have'} a secret crush on you
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              We'll never tell you who. Add your own crushes — if one is mutual, it's a match.
            </Text>
            {!canAdd ? (
              <Button
                title="Find out if it's mutual"
                onPress={() => navigation.navigate('Plans', { reason: 'crush' })}
                style={styles.cardBtn}
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              No secret crushes on you yet
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              When someone adds you, you'll be notified — never with their name.
            </Text>
          </>
        )}
      </View>
    </View>
  );

  const matchCard = (m: CrushMatch) => (
    <Pressable
      key={m.id}
      onPress={() =>
        m.conversation_id
          ? navigation.navigate('ChatThread', { conversationId: m.conversation_id })
          : navigation.navigate('MatchCelebration', { matchId: m.id })
      }
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${m.user.display_name}, matched ${ago(m.matched_at)}`}
      style={({ pressed }) => [styles.match, pressed && styles.pressed]}
    >
      <View>
        <View style={[styles.matchRing, { borderColor: colors.like }]}>
          <Avatar uri={m.user.avatar_url} name={m.user.display_name} size={60} />
        </View>
        <View
          style={[styles.matchHeart, { backgroundColor: colors.like, borderColor: colors.background }]}
        >
          <Heart size={11} color={colors.onButton} fill={colors.onButton} />
        </View>
      </View>
      <Text style={[styles.matchName, { color: colors.text }]} numberOfLines={1}>
        {firstName(m.user.display_name)}
      </Text>
      <Text style={[styles.matchAgo, { color: colors.textSecondary }]} numberOfLines={1}>
        Matched {ago(m.matched_at)}
      </Text>
      <NearbyChip hint={m.nearby_hint} style={styles.matchNear} />
    </Pressable>
  );

  const crushRow = (c: CrushItem) => {
    const paused = c.status === 'paused';
    return (
      <View key={c.user.id} style={styles.row}>
        <Pressable
          onPress={() => navigation.navigate('UserProfile', { username: c.user.username })}
          accessibilityRole="button"
          accessibilityLabel={`${c.user.display_name}. ${paused ? 'Paused' : 'Kept secret'}`}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          <View style={paused && styles.dim}>
            <Avatar uri={c.user.avatar_url} name={c.user.display_name} size={52} />
            <View
              style={[styles.avBadge, { backgroundColor: colors.like, borderColor: colors.background }]}
            >
              <Heart size={10} color={colors.onButton} fill={colors.onButton} />
            </View>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {c.user.display_name}
            </Text>
            {paused ? (
              <View style={styles.inline}>
                <Pause size={11} color={colors.textSecondary} />
                <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                  Paused — renew your plan to reactivate
                </Text>
              </View>
            ) : (
              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                Added {ago(c.added_at)} · kept secret 🤫
              </Text>
            )}
            <NearbyChip hint={c.nearby_hint} />
          </View>
        </Pressable>
        <IconButton
          onPress={() => actions.remove(c.user)}
          accessibilityLabel={`Remove ${c.user.display_name} from Secret Crushes`}
          size={36}
        >
          <X size={18} color={colors.textSecondary} />
        </IconButton>
      </View>
    );
  };

  const upsell = (
    <LockCard
      icon={<Heart size={22} color={colors.primary} />}
      title="Add your own Secret Crushes"
      points={[
        'Plus lets you add up to 3 crushes, Premium up to 10',
        'Mutual crushes become a match with a love chat',
        "If it's not mutual, nobody ever finds out",
      ]}
      priceFrom={priceFrom}
      onChoose={() => navigation.navigate('Plans', { reason: 'crush' })}
    />
  );

  const spots = summary?.spots ?? { limit: actions.spots, used: 0, left: actions.spots };
  const usage = (
    <View style={[styles.usage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Tile size={40}>
        <Heart size={20} color={colors.primary} />
      </Tile>
      <View style={styles.flex}>
        <Text style={[styles.name, { color: colors.text }]}>
          {spots.used} of {spots.limit} crush spots used
        </Text>
        <View style={styles.pips} accessibilityElementsHidden>
          {Array.from({ length: spots.limit }, (_, i) => (
            <View
              key={i}
              style={[styles.pip, { backgroundColor: i < spots.used ? colors.like : colors.border }]}
            />
          ))}
        </View>
        {spots.left === 0 && summary?.plan === 'premium' ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Spots free up when you remove someone
          </Text>
        ) : null}
      </View>
      {spots.left === 0 && summary?.plan !== 'premium' ? (
        <Button
          title="Get more"
          onPress={() => navigation.navigate('Plans', { reason: 'limit' })}
          style={styles.small}
        />
      ) : null}
    </View>
  );

  let list;
  if (!canAdd && !mine.length) {
    list = upsell;
  } else if (listQ.isPending) {
    list = <SkeletonLoader variant="line" width="100%" height={60} />;
  } else if (listQ.isError && !listQ.data) {
    list = (
      <EmptyState
        icon={<CloudOff size={34} color={colors.primary} />}
        title="Couldn't load your crushes"
        actionLabel="Try again"
        onAction={() => listQ.refetch()}
      />
    );
  } else {
    list = (
      <>
        {canAdd ? usage : upsell}
        {mine.length ? (
          <View style={styles.list}>{mine.map(crushRow)}</View>
        ) : (
          <View style={styles.empty}>
            <Tile size={46} muted>
              <Heart size={22} color={colors.textSecondary} />
            </Tile>
            <Text style={[styles.name, { color: colors.text }]}>No crushes yet</Text>
            <Text style={[styles.sub, styles.center, { color: colors.textSecondary }]}>
              Add someone you like. They'll only know it was you if they add you too.
            </Text>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={styles.gap}>
      {received}

      {matches.length ? (
        <>
          <View style={styles.head}>
            <Text style={[styles.headTitle, { color: colors.text }]}>Matches 💘</Text>
            <Text style={[styles.headCount, { color: colors.textSecondary }]}>{matches.length}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matches}
          >
            {matches.map(matchCard)}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: colors.text }]}>Your Secret Crushes</Text>
        {canAdd ? (
          <Pressable
            onPress={actions.openPicker}
            accessibilityRole="button"
            accessibilityLabel="Add a Secret Crush"
            hitSlop={8}
            style={({ pressed }) => [styles.headAdd, pressed && styles.pressed]}
          >
            <Plus size={16} color={colors.primary} />
            <Text style={[styles.headAddText, { color: colors.primary }]}>Add</Text>
          </Pressable>
        ) : null}
      </View>
      {list}
      {canAdd ? (
        <Button title="Add a Secret Crush 💘" onPress={actions.openPicker} style={styles.stretch} />
      ) : null}

      <View style={[styles.rule, { backgroundColor: colors.successSoft }]}>
        <ShieldCheck size={18} color={colors.success} />
        <Text style={[styles.ruleText, { color: colors.text }]}>
          <Text style={styles.bold}>Only mutual crushes are revealed.</Text> If it's not mutual,
          nobody ever finds out — not even whether they added you.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  mt6: { marginTop: 6 },
  bold: { fontWeight: '800' },
  big: { fontSize: 18, fontWeight: '900' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.55 },
  stretch: { alignSelf: 'stretch' },
  small: { minHeight: 34, paddingHorizontal: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  admirers: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  cardBtn: { alignSelf: 'flex-start', marginTop: 10, minHeight: 38 },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontSize: 15, fontWeight: '800' },
  headCount: { fontSize: 13, fontWeight: '700' },
  headAdd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headAddText: { fontSize: 14, fontWeight: '800' },
  matches: { gap: 14, paddingRight: spacing.md },
  match: { width: 84, alignItems: 'center' },
  matchRing: { borderWidth: 2.5, borderRadius: 36, padding: 3 },
  matchHeart: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchName: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  matchAgo: { fontSize: 11 },
  matchNear: { alignSelf: 'center' },
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  name: { fontSize: 15, fontWeight: '700' },
  avBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  empty: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  rule: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
