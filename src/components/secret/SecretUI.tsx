import { useNavigation } from '@react-navigation/native';
import { Check, Crown, Eye, Lock, MapPin, Sparkles, User } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import { nearText } from '@/features/secret/format';
import type { NearbyHint } from '@/services/api/secretMessages';
import type { PlanId } from '@/services/api/subscriptions';
import { radius, spacing, useAppTheme } from '@/theme';

/** Rounded icon tile used across Premium (soft primary wash). */
export function Tile({
  children,
  size = 44,
  badge,
  muted,
}: {
  children: ReactNode;
  size?: number;
  badge?: ReactNode;
  muted?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: muted ? colors.surfaceAlt : colors.primarySoft,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
      {badge ? (
        <View
          style={[
            styles.tileBadge,
            { backgroundColor: colors.button, borderColor: colors.background },
          ]}
        >
          {badge}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Stand-in for a sealed sender. Only a placeholder: the real name and photo never
 * reach the app before the reveal.
 */
export function GhostAvatar({
  size = 52,
  badge,
}: {
  size?: number;
  badge?: 'lock' | 'check' | null;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.ghost,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        <User size={Math.round(size * 0.5)} color={colors.textSecondary} />
      </View>
      {badge ? <AvatarBadge kind={badge} /> : null}
    </View>
  );
}

export function AvatarBadge({ kind }: { kind: 'lock' | 'check' | 'mask' }) {
  const { colors } = useAppTheme();
  const bg = kind === 'check' ? colors.success : colors.button;
  return (
    <View
      style={[
        styles.avBadge,
        { backgroundColor: bg, borderColor: colors.background },
      ]}
    >
      {kind === 'check' ? (
        <Check size={11} color={colors.onButton} strokeWidth={3} />
      ) : kind === 'lock' ? (
        <Lock size={10} color={colors.onButton} strokeWidth={2.6} />
      ) : (
        <Sparkles size={10} color={colors.onButton} strokeWidth={2.6} />
      )}
    </View>
  );
}

/** "Secret Sender" drawn as a blurred bar: nothing to read, nothing to screenshot. */
export function GhostName({ width = 110 }: { width?: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel="Hidden sender"
      style={[styles.ghostName, { width, backgroundColor: colors.skeleton }]}
    />
  );
}

/** Reply 1 → Reply 2 progress for list rows. */
export function MiniTrack({ count }: { count: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.miniTrack} accessibilityElementsHidden>
      {[1, 2].map(i => (
        <View
          key={i}
          style={[
            styles.miniDot,
            { backgroundColor: count >= i ? colors.primary : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

/** 1 Reply — 2 Reply — Reveal. */
export function SealTrack({ count, label }: { count: number; label: string }) {
  const { colors } = useAppTheme();
  const step = (n: number) => {
    const on = count >= n;
    return (
      <View style={styles.step}>
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor: on ? colors.button : colors.surface,
              borderColor: on ? colors.button : colors.border,
            },
          ]}
        >
          {on ? (
            <Check size={13} color={colors.onButton} strokeWidth={3} />
          ) : (
            <Text style={[styles.stepNum, { color: colors.textSecondary }]}>
              {n}
            </Text>
          )}
        </View>
        <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
          Reply
        </Text>
      </View>
    );
  };
  const line = (on: boolean) => (
    <View
      style={[
        styles.stepLine,
        { backgroundColor: on ? colors.button : colors.border },
      ]}
    />
  );
  return (
    <View style={styles.track} accessible accessibilityLabel={label}>
      {step(1)}
      {line(count >= 1)}
      {step(2)}
      {line(count >= 2)}
      <View style={styles.step}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
          ]}
        >
          <Eye size={14} color={colors.primary} />
        </View>
        <Text style={[styles.stepLabel, { color: colors.primary }]}>Reveal</Text>
      </View>
    </View>
  );
}

/** "This person was near you today." or a locked, blurred hint that opens Plans. */
export function NearbyChip({
  hint,
  style,
}: {
  hint: NearbyHint | null | undefined;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  if (!hint) return null;
  if (hint.state === 'locked') {
    return (
      <Pressable
        onPress={() => navigation.navigate('Plans', { reason: 'nearby' })}
        accessibilityRole="button"
        accessibilityLabel="Nearby hint locked. Upgrade to see."
        hitSlop={6}
        style={[styles.near, { backgroundColor: colors.surfaceAlt }, style]}
      >
        <Lock size={11} color={colors.textSecondary} />
        <View style={[styles.nearBlur, { backgroundColor: colors.skeleton }]} />
      </Pressable>
    );
  }
  return (
    <View style={[styles.near, { backgroundColor: colors.primarySoft }, style]}>
      <MapPin size={11} color={colors.primary} />
      <Text style={[styles.nearText, { color: colors.primary }]} numberOfLines={1}>
        {nearText(hint)}
      </Text>
    </View>
  );
}

export function PlanPill({ plan, onPress }: { plan: PlanId; onPress: () => void }) {
  const { colors } = useAppTheme();
  const paid = plan !== 'free';
  const label = plan === 'premium' ? 'Premium' : plan === 'plus' ? 'Plus' : 'Free';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your plan: ${label}. ${paid ? 'Open plans' : 'See plans'}`}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: paid ? colors.button : colors.surfaceAlt,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {plan === 'premium' ? (
        <Crown size={13} color={colors.onButton} />
      ) : plan === 'plus' ? (
        <Sparkles size={13} color={colors.onButton} />
      ) : null}
      <Text
        style={[styles.pillText, { color: paid ? colors.onButton : colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Free users see each Premium feature, clearly marked, with one way to upgrade. */
export function LockCard({
  icon,
  title,
  points,
  priceFrom,
  onChoose,
}: {
  icon: ReactNode;
  title: string;
  points: string[];
  priceFrom: number | null;
  onChoose: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.cardHead}>
        <Tile
          badge={<Lock size={10} color={colors.onButton} strokeWidth={2.6} />}
        >
          {icon}
        </Tile>
        <View style={styles.flex}>
          <View style={[styles.lockTag, { backgroundColor: colors.primarySoft }]}>
            <Crown size={12} color={colors.primary} />
            <Text style={[styles.lockTagText, { color: colors.primary }]}>
              Plus or Premium
            </Text>
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        </View>
      </View>
      {points.map(p => (
        <View key={p} style={styles.point}>
          <Check size={16} color={colors.success} strokeWidth={2.6} />
          <Text style={[styles.pointText, { color: colors.text }]}>{p}</Text>
        </View>
      ))}
      <Button title="Choose a plan" onPress={onChoose} style={styles.cardButton} />
      {priceFrom ? (
        <Text style={[styles.foot, { color: colors.textSecondary }]}>
          From ₹{priceFrom}/month · cancel anytime
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  tileBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  ghostName: { height: 13, borderRadius: 7, marginVertical: 2 },
  miniTrack: { flexDirection: 'row', gap: 4, marginTop: 6 },
  miniDot: { width: 22, height: 4, borderRadius: 2 },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  step: { alignItems: 'center', width: 54 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '800' },
  stepLabel: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  stepLine: { height: 2, width: 26, marginTop: 13, borderRadius: 1 },
  near: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: 6,
    maxWidth: '100%',
  },
  nearText: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  nearBlur: { width: 150, height: 9, borderRadius: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.full,
    marginRight: 4,
  },
  pillText: { fontSize: 12.5, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  lockTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  lockTagText: { fontSize: 11.5, fontWeight: '800' },
  cardTitle: { fontSize: 16.5, fontWeight: '800', marginTop: 4 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 14, lineHeight: 20 },
  cardButton: { alignSelf: 'stretch', marginTop: 6 },
  foot: { fontSize: 12, textAlign: 'center' },
});
