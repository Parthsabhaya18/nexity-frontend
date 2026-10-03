import { useScrollToTop } from '@react-navigation/native';
import {
  Camera,
  Clapperboard,
  Grid3x3,
  Lock,
  type LucideIcon,
  Settings,
  SquarePlus,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { spacing, useAppTheme } from '@/theme';

type ProfileTab = 'posts' | 'reels';

export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [tab, setTab] = useState<ProfileTab>('posts');
  useScrollToTop(scrollRef);
  useStatusBar();

  if (!user) return null;

  const openCreate = () => navigation.navigate('Create');

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
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
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: bottomInset }}
      >
        <View style={styles.head}>
          <View style={styles.top}>
            <Avatar uri={user.avatar_url} name={user.display_name} size={88} />
            <View style={styles.stats}>
              <Stat value={0} label="Posts" />
              <Stat value={0} label="Followers" />
              <Stat value={0} label="Following" />
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
            ) : null}
          </View>
        </View>

        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
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
        </View>

        {tab === 'posts' ? (
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
        ) : (
          <EmptyState
            icon={<Clapperboard size={34} color={colors.primary} />}
            title="No reels yet"
            text="Reels you create will show up here."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCount(n: number) {
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) return `${Math.floor(n / 100) / 10}K`.replace('.0K', 'K');
  return `${Math.floor(n / 100_000) / 10}M`.replace('.0M', 'M');
}

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={[styles.statValue, { color: colors.text }]}>
        {formatCount(value)}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  Icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  Icon: LucideIcon;
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
      <Icon size={20} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  stat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { fontSize: 13, marginTop: 1 },
  info: { marginTop: 14, marginBottom: 14 },
  name: { fontSize: 16, fontWeight: '700' },
  bio: { fontSize: 14.5, lineHeight: 21, marginTop: 4 },
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
  cta: { minWidth: 200 },
});
