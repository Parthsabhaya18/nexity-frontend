import { useNavigation } from '@react-navigation/native';
import { Ban, Clock, Info, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import type { Me, MessagePrivacy } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { type ProfileUpdate, usersApi } from '@/services/api/users';
import { spacing, useAppTheme } from '@/theme';

const MESSAGE_OPTIONS: { value: MessagePrivacy; label: string; sub: string }[] =
  [
    { value: 'everyone', label: 'Everyone', sub: 'Anyone on Nexity can message you' },
    {
      value: 'following',
      label: 'People you follow',
      sub: 'Others can still reply once you message them',
    },
  ];

const defaultPrivacy: Me['privacy'] = {
  show_activity_status: true,
  message_privacy: 'everyone',
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

        <SettingsGroup title="Who can message you">
          {MESSAGE_OPTIONS.map(o => {
            const selected = privacy.message_privacy === o.value;
            return (
              <Pressable
                key={o.value}
                disabled={saving}
                onPress={() =>
                  !selected &&
                  save(
                    { message_privacy: o.value },
                    { ...user, privacy: { ...privacy, message_privacy: o.value } },
                    'Message settings updated',
                  )
                }
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: saving }}
                accessibilityLabel={o.label}
                style={({ pressed }) => [
                  styles.radioRow,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <View style={styles.radioText}>
                  <Text style={[styles.radioLabel, { color: colors.text }]}>
                    {o.label}
                  </Text>
                  <Text
                    style={[styles.radioSub, { color: colors.textSecondary }]}
                  >
                    {o.sub}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selected
                        ? colors.primary
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[styles.radioDot, { backgroundColor: colors.primary }]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  radioText: { flex: 1 },
  radioLabel: { fontSize: 15, fontWeight: '700' },
  radioSub: { fontSize: 12.5, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
});
