import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  KeyRound,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NoteCard,
  SettingsGroup,
  SettingsRow,
  settingsStyles,
} from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError, refreshAccessToken } from '@/services/api/client';
import { type DeviceSession, usersApi } from '@/services/api/users';
import { radius, spacing, useAppTheme } from '@/theme';
import { timeAgoLong } from '@/utils/time';

function sessionDetail(s: DeviceSession) {
  const app = s.app_version ? `Nexity app ${s.app_version}` : 'Nexity app';
  const when = s.current
    ? 'Active now'
    : `Last active ${timeAgoLong(Date.parse(s.last_active_at)).toLowerCase()}`;
  return `${app} · ${when}`;
}

export function LoginSecurityScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  useStatusBar();

  const load = useCallback(async () => {
    try {
      let list = await usersApi.sessions();
      // Access tokens from older app versions don't name their session; a refresh does.
      if (list.length && !list.some(s => s.current)) {
        await refreshAccessToken();
        list = await usersApi.sessions();
      }
      setSessions(list);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) return null;
  const others = (sessions ?? []).filter(s => !s.current);
  const knowsCurrent = (sessions ?? []).some(s => s.current);

  const logoutOne = async (s: DeviceSession) => {
    setPendingId(s.id);
    try {
      await usersApi.logoutSession(s.id);
      setSessions(list => (list ?? []).filter(x => x.id !== s.id));
      toast.success(`${s.device} logged out`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const logoutOthers = async () => {
    setLoggingOutOthers(true);
    try {
      await usersApi.logoutOtherSessions();
      setSessions(list => (list ?? []).filter(x => x.current));
      toast.success('Logged out of all other devices');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoggingOutOthers(false);
      setConfirmOthers(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Login & security" back />
      <ScrollView
        contentContainerStyle={settingsStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SettingsGroup title="Password">
          <SettingsRow
            icon={KeyRound}
            label="Change password"
            sub={
              user.password_changed_at
                ? `Last changed ${timeAgoLong(
                    Date.parse(user.password_changed_at),
                  ).toLowerCase()}`
                : undefined
            }
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </SettingsGroup>

        <SettingsGroup title="Where you're logged in">
          {sessions === null ? (
            <View style={styles.state}>
              {failed ? (
                <>
                  <Text style={{ color: colors.textSecondary }}>
                    Couldn't load your devices.
                  </Text>
                  <Button
                    title="Try again"
                    variant="secondary"
                    onPress={() => {
                      setFailed(false);
                      load();
                    }}
                  />
                </>
              ) : (
                <ActivityIndicator color={colors.primary} />
              )}
            </View>
          ) : (
            sessions.map(s => {
              const Icon = s.platform === 'web' ? Monitor : Smartphone;
              return (
                <View key={s.id} style={styles.device}>
                  <View
                    style={[styles.icon, { backgroundColor: colors.primarySoft }]}
                  >
                    <Icon size={19} color={colors.primary} />
                  </View>
                  <View style={styles.deviceText}>
                    <Text style={[styles.deviceName, { color: colors.text }]}>
                      {s.current ? `This device · ${s.device}` : s.device}
                    </Text>
                    <Text
                      style={[styles.deviceSub, { color: colors.textSecondary }]}
                    >
                      {sessionDetail(s)}
                    </Text>
                  </View>
                  {s.current ? (
                    <View
                      style={[styles.current, { backgroundColor: colors.successSoft }]}
                    >
                      <Text style={[styles.currentText, { color: colors.success }]}>
                        Current
                      </Text>
                    </View>
                  ) : !knowsCurrent ? null : (
                    <Pressable
                      onPress={() => logoutOne(s)}
                      disabled={pendingId === s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Log out ${s.device}`}
                      style={({ pressed }) => [
                        styles.smallBtn,
                        { borderColor: colors.border },
                        pressed && styles.pressed,
                      ]}
                    >
                      {pendingId === s.id ? (
                        <ActivityIndicator size="small" color={colors.text} />
                      ) : (
                        <Text style={[styles.smallBtnText, { color: colors.text }]}>
                          Log out
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </SettingsGroup>

        {others.length && knowsCurrent ? (
          <Button
            title="Log out of all other devices"
            variant="secondary"
            onPress={() => setConfirmOthers(true)}
          />
        ) : null}

        <NoteCard icon={ShieldCheck}>
          Don't recognise a device? Log it out and change your password. Your
          account email is {user.email}.
        </NoteCard>
      </ScrollView>

      <ConfirmDialog
        visible={confirmOthers}
        title="Log out of other devices?"
        message="You'll stay logged in on this device."
        confirmLabel="Log out others"
        destructive
        loading={loggingOutOthers}
        onCancel={() => setConfirmOthers(false)}
        onConfirm={logoutOthers}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  state: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: { flex: 1, minWidth: 0 },
  deviceName: { fontSize: 15, fontWeight: '700' },
  deviceSub: { fontSize: 12.5, marginTop: 2 },
  current: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  currentText: { fontSize: 11.5, fontWeight: '800' },
  smallBtn: {
    minWidth: 72,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
