import { useNavigation } from '@react-navigation/native';
import { Ban, Clock, Info, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import {
  NoteCard,
  SettingsGroup,
  SettingsRow,
  SettingsToggleRow,
  settingsStyles,
} from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStatusBar } from '@/navigation/useStatusBar';
import type { Me } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { type ProfileUpdate, usersApi } from '@/services/api/users';
import { useAppTheme } from '@/theme';

const defaultPrivacy: Me['privacy'] = {
  show_activity_status: true,
};

export function PrivacySettingsScreen() {
  const { colors } = useAppTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  useStatusBar();
  if (!user) return null;
  const privacy = user.privacy ?? defaultPrivacy;

  /** Shows the change at once and puts it back if the server refuses. */
  const save = async (
    change: ProfileUpdate,
    optimistic: Me,
    message = 'Privacy updated',
  ) => {
    if (saving) return;
    const previous = user;
    setSaving(true);
    await updateUser(optimistic);
    try {
      await updateUser(await usersApi.updateMe(change));
      toast.success(message);
    } catch (err) {
      await updateUser(previous);
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't save. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Privacy" back />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <SettingsGroup title="Account">
          <SettingsToggleRow
            icon={Lock}
            label="Private account"
            sub="Only approved followers see your posts, reels and stories"
            value={user.is_private}
            disabled={saving}
            onChange={v =>
              save({ is_private: v }, { ...user, is_private: v })
            }
          />
          <SettingsToggleRow
            icon={Clock}
            label="Show activity status"
            sub="Let people see when you're active or were last active"
            value={privacy.show_activity_status}
            disabled={saving}
            onChange={v =>
              save(
                { show_activity_status: v },
                { ...user, privacy: { ...privacy, show_activity_status: v } },
              )
            }
          />
        </SettingsGroup>

        <NoteCard icon={Info}>
          With activity status off, nobody sees "Active now" or when you were
          last active, including in chats. People you block can't find your
          profile, posts or stories.
        </NoteCard>

        <SettingsGroup>
          <SettingsRow
            icon={Ban}
            label="Blocked accounts"
            onPress={() => navigation.navigate('BlockedAccounts')}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
