import { Bell, Check, MapPin, Radar, ShieldCheck } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { queryClient } from '@/features/entities/entityCache';
import { isUsable, type PermissionStatus } from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { deviceTimezone } from '@/features/secret/format';
import { secretKeys, useNearbySettings } from '@/features/secret/secretQueries';
import { ApiError } from '@/services/api/client';
import { nearbyApi, type NearbySettingsPatch } from '@/services/api/nearby';
import { radius, spacing, useAppTheme } from '@/theme';

import { Tile } from './SecretUI';

type RowState = 'on' | 'off' | 'settings' | 'unavailable';

const rowState = (status: PermissionStatus | undefined): RowState =>
  isUsable(status)
    ? 'on'
    : status === 'blocked'
    ? 'settings'
    : status === 'unavailable'
    ? 'unavailable'
    : 'off';

function Row({
  icon,
  title,
  text,
  state,
  busy,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  state: RowState;
  busy?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const label =
    state === 'on'
      ? 'Allowed'
      : state === 'settings'
      ? 'Open Settings'
      : state === 'unavailable'
      ? 'Unavailable'
      : 'Allow';
  const on = state === 'on';
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Tile size={40}>{icon}</Tile>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{text}</Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={on || busy || state === 'unavailable'}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${label}`}
        accessibilityState={{ disabled: on || state === 'unavailable', busy: !!busy }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.allow,
          {
            backgroundColor: on ? colors.successSoft : colors.button,
            opacity: pressed ? 0.75 : state === 'unavailable' ? 0.5 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.onButton} />
        ) : on ? (
          <Check size={15} color={colors.success} strokeWidth={3} />
        ) : null}
        {!busy ? (
          <Text
            style={[
              styles.allowText,
              { color: on ? colors.success : colors.onButton },
            ]}
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * Shown when Premium opens and something is missing. Every permission is asked for
 * on its own; nothing is required to keep using Secret Messages.
 */
export function PremiumPermissionsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const notifications = usePermission('notifications');
  const location = usePermission('location');
  const nearby = useNearbySettings().data;
  const [busy, setBusy] = useState<'notifications' | 'location' | 'nearby' | null>(null);

  const saveNearby = async (patch: NearbySettingsPatch) => {
    const next = await nearbyApi.update(patch);
    queryClient.setQueryData(secretKeys.nearby, next);
    return next;
  };

  const ask = async (kind: 'notifications' | 'location') => {
    const perm = kind === 'notifications' ? notifications : location;
    if (perm.status === 'blocked') {
      await perm.openSettings();
      return;
    }
    setBusy(kind);
    try {
      const status = await perm.requestNow();
      if (kind === 'location' && isUsable(status) && nearby?.enabled && !nearby.location_enabled) {
        await saveNearby({ location_enabled: true }).catch(() => {});
      }
      if (status === 'blocked') {
        showToast('Turn it on in Settings, then come back.', 'info');
      }
    } finally {
      setBusy(null);
    }
  };

  const turnOnNearby = async () => {
    setBusy('nearby');
    try {
      await saveNearby({
        enabled: true,
        location_enabled: isUsable(location.status),
        timezone: deviceTimezone(),
      });
      showToast('Nearby is on', 'success');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Couldn't turn on Nearby. Try again.",
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const nearbyState: RowState = !nearby
    ? 'off'
    : !nearby.feature_available
    ? 'unavailable'
    : nearby.enabled
    ? 'on'
    : 'off';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Get the most out of Premium
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Allow each one on its own. You can change them anytime in Settings → Nearby.
        </Text>

        <Row
          icon={<Bell size={20} color={colors.primary} />}
          title="Notifications"
          text="Know the moment someone sends you a Secret Message."
          state={rowState(notifications.status)}
          busy={busy === 'notifications'}
          onPress={() => ask('notifications')}
        />
        <Row
          icon={<MapPin size={20} color={colors.primary} />}
          title="Location"
          text="Only while you use Nexity, to tell if a sender was near you today. Never shown to anyone."
          state={rowState(location.status)}
          busy={busy === 'location'}
          onPress={() => ask('location')}
        />
        <Row
          icon={<Radar size={20} color={colors.primary} />}
          title="Nearby"
          text={
            nearbyState === 'unavailable'
              ? 'Nearby is paused for everyone right now.'
              : 'See "This person was near you today" on Secret Messages. Turn off anytime.'
          }
          state={nearbyState}
          busy={busy === 'nearby'}
          onPress={turnOnNearby}
        />

        <View style={[styles.privacy, { backgroundColor: colors.surfaceAlt }]}>
          <ShieldCheck size={16} color={colors.success} />
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
            Your exact place is never stored or shown. Location stops when you close the app.
          </Text>
        </View>

        <Button title="Done" onPress={onClose} style={styles.done} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 10 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  sub: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  allow: {
    minWidth: 86,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  allowText: { fontSize: 13, fontWeight: '800' },
  privacy: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    marginTop: 4,
  },
  privacyText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  done: { alignSelf: 'stretch', marginTop: 4 },
});
