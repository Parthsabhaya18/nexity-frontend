import { Bell, Bluetooth, MapPin, Radar, ShieldCheck } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tile } from '@/components/secret/SecretUI';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { queryClient } from '@/features/entities/entityCache';
import { ensurePreciseLocation } from '@/features/nearby/preciseLocation';
import { isUsable, type PermissionStatus } from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { deviceTimezone } from '@/features/secret/format';
import { secretKeys, useNearbySettings, useSubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { nearbyApi, type NearbySettingsPatch } from '@/services/api/nearby';
import { radius, spacing, useAppTheme } from '@/theme';

const statusText = (s: PermissionStatus | undefined, precise = false) =>
  s === 'granted'
    ? 'Allowed'
    : s === 'limited'
      ? precise
        ? 'Precise location is off'
        : 'Approximate only'
      : s === 'blocked'
        ? 'Off in phone settings'
        : s === 'unavailable'
          ? 'Not available on this device'
          : 'Not allowed yet';

function Row({
  icon,
  title,
  text,
  right,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  right: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Tile size={38}>{icon}</Tile>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{text}</Text>
      </View>
      {right}
    </View>
  );
}

export function NearbySettingsScreen({ navigation }: ScreenProps<'NearbySettings'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const settingsQ = useNearbySettings();
  const settings = settingsQ.data;
  const hasNearby = useSubscription().data?.limits.nearby ?? false;
  const location = usePermission('location');
  const bluetooth = usePermission('bluetooth');
  const notifications = usePermission('notifications');
  const [saving, setSaving] = useState(false);

  const save = async (patch: NearbySettingsPatch) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await nearbyApi.update(patch);
      queryClient.setQueryData(secretKeys.nearby, next);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const setMaster = (on: boolean) =>
    save(
      on
        ? { enabled: true, location_enabled: location.status === 'granted', timezone: deviceTimezone() }
        : { enabled: false, location_enabled: false },
    );

  const setLocation = async (on: boolean) => {
    if (!on) return save({ location_enabled: false });
    let status = await location.request();
    if (status === 'limited') status = await ensurePreciseLocation();
    if (status === 'granted') {
      save({ location_enabled: true, timezone: deviceTimezone() });
      return;
    }
    if (status === 'limited') {
      showToast('Precise location is off. Nearby needs it. Turn it on in Settings.', 'info');
    }
  };

  const setBluetooth = async (on: boolean) => {
    if (!on) return save({ bluetooth_enabled: false });
    const status = await bluetooth.requestNow();
    if (isUsable(status)) {
      save({ bluetooth_enabled: true });
      return;
    }
    if (status === 'blocked') {
      showToast('Allow Nearby devices in phone settings to use Bluetooth.', 'error');
      bluetooth.openSettings();
      return;
    }
    showToast(
      status === 'unavailable'
        ? 'Bluetooth is not available on this phone.'
        : 'Allow Nearby devices to find people around you.',
      'error',
    );
  };

  const permButton = (perm: typeof location, label: string) => {
    const preciseOff = label === 'Location' && perm.status === 'limited';
    if (isUsable(perm.status) && !preciseOff) return null;
    const blocked = perm.status === 'blocked' || preciseOff;
    return (
      <Pressable
        onPress={() => (blocked ? perm.openSettings() : perm.request())}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${blocked ? 'Open Settings' : 'Allow'}`}
        style={({ pressed }) => [
          styles.allow,
          { backgroundColor: colors.button, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[styles.allowText, { color: colors.onButton }]}>
          {blocked ? 'Settings' : 'Allow'}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Nearby" back />
      <ScrollView contentContainerStyle={styles.content}>
        {!settings ? (
          <SkeletonLoader variant="rect" height={220} radius={radius.lg} />
        ) : (
          <>
            {!settings.feature_available ? (
              <Banner tone="info" message="Nearby is paused for everyone right now." />
            ) : null}
            {!hasNearby ? (
              <Pressable onPress={() => navigation.navigate('Plans', { reason: 'nearby' })}>
                <Banner
                  tone="info"
                  message="Nearby hints in Secret Messages need Plus or Premium. Tap to see plans."
                />
              </Pressable>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row
                icon={<Radar size={19} color={colors.primary} />}
                title="Nearby"
                text='Show "This person was near you today" on Secret Messages.'
                right={
                  <Toggle
                    value={settings.enabled}
                    onChange={setMaster}
                    disabled={saving || !settings.feature_available}
                    accessibilityLabel="Nearby"
                  />
                }
              />
              <Row
                icon={<Bluetooth size={19} color={colors.primary} />}
                title="Bluetooth discovery"
                text="Show people around you in a circle while Nexity is open."
                right={
                  <Toggle
                    value={settings.enabled && settings.bluetooth_enabled}
                    onChange={setBluetooth}
                    disabled={saving || !settings.enabled}
                    accessibilityLabel="Bluetooth discovery"
                  />
                }
              />
              <Row
                icon={<MapPin size={19} color={colors.primary} />}
                title="Use location"
                text="Only while Nexity is open. Never in the background."
                right={
                  <Toggle
                    value={settings.enabled && settings.location_enabled && location.status === 'granted'}
                    onChange={setLocation}
                    disabled={saving || !settings.enabled}
                    accessibilityLabel="Use location for Nearby"
                  />
                }
              />
              <Row
                icon={<Bell size={19} color={colors.primary} />}
                title="Nearby notifications"
                text='"Someone is near you on Nexity. ✨" A few times a day at most.'
                right={
                  <Toggle
                    value={settings.enabled && settings.notifications_enabled}
                    onChange={on => save({ notifications_enabled: on })}
                    disabled={saving || !settings.enabled}
                    accessibilityLabel="Nearby notifications"
                  />
                }
              />
            </View>

            <Button
              title="See who's nearby"
              onPress={() => navigation.navigate('Nearby')}
              disabled={!settings.enabled}
            />

            <Text style={[styles.section, { color: colors.textSecondary }]}>Phone permissions</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row
                icon={<MapPin size={19} color={colors.primary} />}
                title="Location"
                text={statusText(location.status, true)}
                right={permButton(location, 'Location')}
              />
              <Row
                icon={<Bell size={19} color={colors.primary} />}
                title="Notifications"
                text={statusText(notifications.status)}
                right={permButton(notifications, 'Notifications')}
              />
              <Row
                icon={<Bluetooth size={19} color={colors.primary} />}
                title="Bluetooth"
                text={statusText(bluetooth.status)}
                right={permButton(bluetooth, 'Bluetooth')}
              />
            </View>

            <View style={[styles.privacy, { backgroundColor: colors.surfaceAlt }]}>
              <ShieldCheck size={16} color={colors.success} />
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                Nobody sees your location. Locations are rounded, kept for minutes, and deleted
                when you turn Nearby off. Hints say only today or yesterday.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 6, marginLeft: 4 },
  allow: { borderRadius: radius.full, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  allowText: { fontSize: 13, fontWeight: '800' },
  privacy: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, alignItems: 'center' },
  privacyText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
});
