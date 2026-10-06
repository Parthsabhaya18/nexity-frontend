import { Link2, type LucideIcon } from 'lucide-react-native';
import { useRef } from 'react';
import {
  Alert,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { displayWebsite } from '@/features/profile/schemas';
import { isTabSwipe, swipedTab } from '@/features/profile/tabSwipe';
import { useAppTheme } from '@/theme';

export function formatCount(n: number) {
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) return `${Math.floor(n / 100) / 10}K`.replace('.0K', 'K');
  return `${Math.floor(n / 100_000) / 10}M`.replace('.0M', 'M');
}

export function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  /** Without it the stat is plain text. */
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      <Text style={[styles.statValue, { color: colors.text }]}>
        {formatCount(value)}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TabButton({
  label,
  active,
  onPress,
  Icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  Icon?: LucideIcon;
}) {
  const { colors } = useAppTheme();
  const color = active ? colors.text : colors.textSecondary;
  const indicator = active ? colors.text : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tab, { borderBottomColor: indicator }]}
    >
      {Icon ? <Icon size={20} color={color} /> : null}
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function TabBar({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.tabs, { borderBottomColor: colors.border }]}
      accessibilityRole="tablist"
    >
      {children}
    </View>
  );
}

/** Tab content that also switches tabs on a left / right swipe (Instagram profile). */
export function SwipeTabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  children: React.ReactNode;
}) {
  const latest = useRef({ tabs, value, onChange });
  latest.current = { tabs, value, onChange };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => isTabSwipe(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        const now = latest.current;
        const next = swipedTab(now.tabs, now.value, g.dx, g.vx);
        if (next) now.onChange(next);
      },
    }),
  ).current;
  return (
    <View style={styles.swipeArea} {...responder.panHandlers}>
      {children}
    </View>
  );
}

export function WebsiteLink({ url }: { url: string }) {
  const { colors } = useAppTheme();
  const open = () =>
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open link", url));
  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => [styles.website, pressed && styles.pressed]}
    >
      <Link2 size={15} color={colors.primary} />
      <Text
        style={[styles.websiteText, { color: colors.primary }]}
        numberOfLines={1}
      >
        {displayWebsite(url)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { fontSize: 13, marginTop: 1 },
  pressed: { opacity: 0.6 },
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
  tabLabel: { fontSize: 14, fontWeight: '700' },
  // Room to swipe even when a tab is empty or still loading.
  swipeArea: { minHeight: 320 },
  website: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  websiteText: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
});
