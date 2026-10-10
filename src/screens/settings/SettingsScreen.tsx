import { APP_VERSION } from '@env';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Ban,
  Bell,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Crown,
  FileText,
  Headset,
  KeyRound,
  LayoutGrid,
  LogOut,
  Mail,
  MonitorSmartphone,
  Radar,
  Shield,
  ShieldCheck,
  User,
  VenetianMask,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SettingsGroup,
  SettingsRow,
  settingsStyles,
} from '@/components/settings/SettingsParts';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStatusBar } from '@/navigation/useStatusBar';
import { safetyApi } from '@/services/api/safety';
import { radius, spacing, useAppTheme } from '@/theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  useStatusBar();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      safetyApi
        .blocked()
        .then(page => active && setBlockedCount(page.total))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  if (!user) return null;

  const privacySub = [
    user.is_private ? 'Private account' : 'Public account',
    user.privacy?.message_privacy === 'following'
      ? 'messages from people you follow'
      : 'messages from everyone',
  ].join(' · ');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Settings" back />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel={`${user.display_name}, edit profile`}
          style={({ pressed }) => [
            styles.profile,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
          <View style={styles.profileText}>
            <Text
              style={[styles.profileName, { color: colors.text }]}
              numberOfLines={1}
            >
              {user.display_name}
            </Text>
            <Text
              style={[styles.profileHandle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              @{user.username}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>

        <SettingsGroup title="Account">
          <SettingsRow
            icon={User}
            label="Edit profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsRow
            icon={Mail}
            label="Account information"
            sub="Email, username, birthday"
            onPress={() => navigation.navigate('AccountInfo')}
          />
        </SettingsGroup>

        <SettingsGroup title="Privacy">
          <SettingsRow
            icon={Shield}
            label="Privacy"
            sub={privacySub}
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SettingsRow
            icon={Ban}
            label="Blocked accounts"
            value={blockedCount ? String(blockedCount) : undefined}
            onPress={() => navigation.navigate('BlockedAccounts')}
          />
          <SettingsRow
            icon={VenetianMask}
            label="Blocked secret senders"
            onPress={() => navigation.navigate('SecretBlocks')}
          />
          <SettingsRow
            icon={Radar}
            label="Nearby & location"
            onPress={() => navigation.navigate('NearbySettings')}
          />
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <SettingsRow
            icon={Bell}
            label="Notification settings"
            sub={
              user.notification_settings?.paused
                ? 'Paused'
                : 'Choose what you hear about'
            }
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </SettingsGroup>

        <SettingsGroup title="Subscription">
          <SettingsRow
            icon={Crown}
            label="Plans"
            onPress={() => navigation.navigate('Plans')}
          />
          <SettingsRow
            icon={CreditCard}
            label="Subscription & billing"
            onPress={() => navigation.navigate('Subscription')}
          />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingsRow
            icon={KeyRound}
            label="Change password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SettingsRow
            icon={MonitorSmartphone}
            label="Login & security"
            sub="Where you're logged in"
            onPress={() => navigation.navigate('LoginSecurity')}
          />
        </SettingsGroup>

        <SettingsGroup title="Theme">
          <ThemePicker />
        </SettingsGroup>

        <SettingsGroup title="Help">
          <SettingsRow
            icon={Headset}
            label="Contact us"
            sub="We usually reply within 24 hours"
            onPress={() => navigation.navigate('ContactUs')}
          />
          <SettingsRow
            icon={CircleHelp}
            label="Help center"
            onPress={() => navigation.navigate('HelpCenter')}
          />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingsRow
            icon={FileText}
            label="Terms of Service"
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
          />
          <SettingsRow
            icon={ShieldCheck}
            label="Privacy Policy"
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
          />
        </SettingsGroup>

        {__DEV__ ? (
          <SettingsGroup title="Developer">
            <SettingsRow
              icon={LayoutGrid}
              label="Component gallery"
              onPress={() => navigation.navigate('DevComponents')}
            />
          </SettingsGroup>
        ) : null}

        <Pressable
          onPress={() => setConfirmLogout(true)}
          disabled={signingOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.logout,
            { backgroundColor: colors.dangerSoft },
            pressed && styles.pressed,
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <LogOut size={18} color={colors.danger} />
          )}
          <Text style={[styles.logoutText, { color: colors.danger }]}>
            Log out
          </Text>
        </Pressable>
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          Nexity v{APP_VERSION}
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogout}
        title="Log out of Nexity?"
        message={`You can log back in anytime as @${user.username}.`}
        confirmLabel="Log out"
        destructive
        loading={signingOut}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 17, fontWeight: '800' },
  profileHandle: { fontSize: 14, marginTop: 2 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  logoutText: { fontSize: 15.5, fontWeight: '800' },
  version: { textAlign: 'center', fontSize: 12.5 },
  pressed: { opacity: 0.75 },
});
