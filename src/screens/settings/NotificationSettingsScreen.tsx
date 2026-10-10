import { Bell, Heart, MessageCircle } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import {
  SettingsGroup,
  SettingsToggleRow,
  settingsStyles,
} from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStatusBar } from '@/navigation/useStatusBar';
import type { NotificationSettings } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { usersApi } from '@/services/api/users';
import { useAppTheme } from '@/theme';

const DEFAULTS: NotificationSettings = {
  paused: false,
  comments: true,
  story_likes: true,
};

const KINDS: {
  key: Exclude<keyof NotificationSettings, 'paused'>;
  label: string;
  sub: string;
  icon: typeof Bell;
}[] = [
  {
    key: 'comments',
    label: 'Comments',
    sub: 'Comments and replies on your posts and reels',
    icon: MessageCircle,
  },
  {
    key: 'story_likes',
    label: 'Story likes',
    sub: 'When someone likes your story',
    icon: Heart,
  },
];

export function NotificationSettingsScreen() {
  const { colors } = useAppTheme();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  /** Last confirmed settings, so a failed save rolls back to them. */
  const confirmed = useRef<NotificationSettings | null>(null);
  useStatusBar();
  if (!user) return null;
  const settings = user.notification_settings ?? DEFAULTS;
  confirmed.current ??= settings;

  const change = async (patch: Partial<NotificationSettings>) => {
    const next = { ...settings, ...patch };
    await updateUser({ ...user, notification_settings: next });
    try {
      const saved = await usersApi.updateNotificationSettings(patch);
      confirmed.current = saved;
      await updateUser({ ...user, notification_settings: saved });
    } catch (err) {
      await updateUser({
        ...user,
        notification_settings: confirmed.current ?? settings,
      });
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't save. Try again.",
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Notifications" back />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <SettingsGroup>
          <SettingsToggleRow
            icon={Bell}
            label="Pause all"
            sub="Stop every activity notification at once"
            value={settings.paused}
            onChange={v => change({ paused: v })}
          />
        </SettingsGroup>

        <SettingsGroup title="Notify me about">
          {KINDS.map(k => (
            <SettingsToggleRow
              key={k.key}
              icon={k.icon}
              label={k.label}
              sub={k.sub}
              value={settings[k.key] && !settings.paused}
              disabled={settings.paused}
              onChange={v => change({ [k.key]: v })}
            />
          ))}
        </SettingsGroup>

        <Text style={[settingsStyles.fine, { color: colors.textSecondary }]}>
          These control what appears in your Notifications. Messages always
          show up in your chats with an unread badge.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
