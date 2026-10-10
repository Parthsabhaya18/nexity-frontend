import { useNavigation } from '@react-navigation/native';
import {
  Ban,
  ChevronRight,
  CreditCard,
  Crown,
  LayoutGrid,
  LogOut,
  Palette,
  Radar,
  VenetianMask,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Me } from '@/services/api/auth';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [signingOut, setSigningOut] = useState(false);
  useStatusBar();

  if (!user) return null;

  const confirmSignOut = () =>
    Alert.alert(
      'Log out?',
      `You'll need to log in again as @${user.username}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ],
    );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Settings" back />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          style={({ pressed }) => [
            styles.card,
            styles.profile,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Avatar uri={user.avatar_url} name={user.display_name} size={52} />
          <View style={styles.profileText}>
            <Text
              style={[styles.profileName, { color: colors.text }]}
              numberOfLines={1}
            >
              {user.display_name}
            </Text>
            <Text
              style={[styles.rowLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Edit profile
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Appearance')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Palette size={20} color={colors.primary} />
          <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
            Theme
          </Text>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {themeLabel(user)}
          </Text>
        </Pressable>

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Privacy
        </Text>
        <Pressable
          onPress={() => navigation.navigate('BlockedAccounts')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Ban size={20} color={colors.text} />
          <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
            Blocked accounts
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        {[
          {
            label: 'Blocked secret senders',
            icon: <VenetianMask size={20} color={colors.text} />,
            go: () => navigation.navigate('SecretBlocks'),
          },
          {
            label: 'Nearby & location',
            icon: <Radar size={20} color={colors.text} />,
            go: () => navigation.navigate('NearbySettings'),
          },
        ].map(item => (
          <Pressable
            key={item.label}
            onPress={item.go}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.card,
              styles.logout,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            {item.icon}
            <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
              {item.label}
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        ))}

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Premium
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Plans')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Crown size={20} color={colors.primary} />
          <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
            Plans
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Subscription')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <CreditCard size={20} color={colors.text} />
          <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
            Subscription & billing
          </Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>

        {__DEV__ ? (
          <>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              Developer
            </Text>
            <Pressable
              onPress={() => navigation.navigate('DevComponents')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                styles.logout,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <LayoutGrid size={20} color={colors.text} />
              <Text style={[styles.logoutText, { color: colors.text, flex: 1 }]}>
                Component gallery
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Account
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Row label="Username" value={`@${user.username}`} />
          <Row label="Email" value={user.email} />
          <Row label="Account" value={user.is_private ? 'Private' : 'Public'} />
        </View>

        <Pressable
          onPress={confirmSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <LogOut size={20} color={colors.danger} />
          )}
          <Text style={[styles.logoutText, { color: colors.danger }]}>
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const MOOD_LABEL: Record<NonNullable<Me['preferences']['mood']>, string> = {
  happy: '😊 Happy',
  calm: '😌 Calm',
  romantic: '❤️ Romantic',
  sad: '😢 Sad',
  angry: '😡 Angry',
  cool: '😎 Cool',
  relaxed: '🌿 Relaxed',
  excited: '🔥 Excited',
  tired: '😴 Tired',
  motivated: '🤩 Motivated',
};

function themeLabel(user: Me) {
  return user.preferences.mood
    ? MOOD_LABEL[user.preferences.mood]
    : user.preferences.theme === 'light'
    ? 'Light'
    : user.preferences.theme === 'dark'
    ? 'Dark'
    : 'System default';
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm },
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14 },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
