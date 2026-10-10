import { useNavigation } from '@react-navigation/native';
import { BadgeCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  InfoRow,
  SettingsGroup,
  SettingsRow,
  settingsStyles,
} from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { KeyboardScrollView } from '@/components/ui/KeyboardScrollView';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStatusBar } from '@/navigation/useStatusBar';
import type { Gender } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { usersApi } from '@/services/api/users';
import { radius, spacing, useAppTheme } from '@/theme';
import { fullDate } from '@/utils/time';

const GENDER_LABEL: Record<Gender, string> = {
  woman: 'Woman',
  man: 'Man',
  other: 'Other',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

export function AccountInfoScreen() {
  const { colors } = useAppTheme();
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useStatusBar();
  if (!user) return null;

  const askConfirm = () => {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setError(undefined);
    setConfirm(true);
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await usersApi.deleteAccount(password);
      setConfirm(false);
      await signOut();
      toast.success('Your account was deleted');
    } catch (err) {
      setBusy(false);
      setConfirm(false);
      const message =
        err instanceof ApiError ? err.message : 'Please try again.';
      if (err instanceof ApiError && err.code === 'INVALID_PASSWORD') {
        setError(message);
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Account information" back />
      <KeyboardScrollView contentContainerStyle={settingsStyles.content}>
        <SettingsGroup>
          <InfoRow label="Name" value={user.display_name} />
          <InfoRow label="Username" value={`@${user.username}`} />
          <InfoRow
            label="Email"
            value={user.email}
            trailing={
              user.is_verified ? (
                <View
                  style={[styles.badge, { backgroundColor: colors.successSoft }]}
                >
                  <BadgeCheck size={12} color={colors.success} />
                  <Text style={[styles.badgeText, { color: colors.success }]}>
                    Verified
                  </Text>
                </View>
              ) : null
            }
          />
          <InfoRow label="Gender" value={GENDER_LABEL[user.gender]} />
          <InfoRow
            label="Date of birth"
            value={`${fullDate(user.date_of_birth)} · private`}
          />
          <InfoRow label="Member since" value={fullDate(user.created_at)} />
        </SettingsGroup>

        <Button
          title="Edit profile"
          variant="secondary"
          onPress={() => navigation.navigate('EditProfile')}
        />

        <SettingsGroup title="Danger zone">
          {deleting ? (
            <View style={styles.deleteBox}>
              <Text style={[styles.deleteTitle, { color: colors.danger }]}>
                Delete your account
              </Text>
              <Text style={[styles.deleteText, { color: colors.textSecondary }]}>
                Your profile, posts, reels, stories and followers will be
                removed and your username becomes available to others. This
                can't be undone.
              </Text>
              <TextField
                label="Enter your password to continue"
                password
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  if (error) setError(undefined);
                }}
                error={error}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={askConfirm}
              />
              <View style={styles.deleteActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  style={styles.flex}
                  onPress={() => {
                    setDeleting(false);
                    setPassword('');
                    setError(undefined);
                  }}
                />
                <Button
                  title="Delete"
                  style={{
                    ...styles.flex,
                    backgroundColor: colors.danger,
                    borderColor: colors.danger,
                  }}
                  onPress={askConfirm}
                />
              </View>
            </View>
          ) : (
            <SettingsRow
              icon={Trash2}
              label="Delete account"
              sub="Permanently remove your account and data"
              danger
              onPress={() => setDeleting(true)}
            />
          )}
        </SettingsGroup>
      </KeyboardScrollView>

      <ConfirmDialog
        visible={confirm}
        title="Delete your account?"
        message="Your profile, posts, chats and followers will be permanently deleted. This can't be undone."
        confirmLabel="Delete account"
        destructive
        loading={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={deleteAccount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  deleteBox: { padding: spacing.md },
  deleteTitle: { fontSize: 15, fontWeight: '800' },
  deleteText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  deleteActions: { flexDirection: 'row', gap: spacing.sm },
});
