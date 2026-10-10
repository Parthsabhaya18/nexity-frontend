import { useFocusEffect } from '@react-navigation/native';
import { Bluetooth, Radar } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { queryClient } from '@/features/entities/entityCache';
import { nearbyBle, nearbyBleAvailable, nearbyBleEvents } from '@/features/nearby/ble';
import { checkPermission, isUsable } from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { deviceTimezone } from '@/features/secret/format';
import { secretKeys, useNearbySettings } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { nearbyApi } from '@/services/api/nearby';
import { followsApi } from '@/services/api/follows';
import { radius, spacing, useAppTheme } from '@/theme';

type Person = Awaited<ReturnType<typeof nearbyApi.nearbyUsers>>['items'][number];
type Sighting = {
  eph_id: string;
  first_seen_at: string;
  last_seen_at: string;
  count: number;
  rssi_max: number;
};

const currentId = (items: { eph_id: string; valid_from: string; valid_until: string }[]) => {
  const now = Date.now();
  return items.find(item => now >= Date.parse(item.valid_from) && now < Date.parse(item.valid_until))?.eph_id
    ?? items[0]?.eph_id
    ?? null;
};

export function NearbyScreen({ navigation }: ScreenProps<'Nearby'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const settingsQ = useNearbySettings();
  const settings = settingsQ.data;
  const bluetooth = usePermission('bluetooth');
  const location = usePermission('location');
  const [people, setPeople] = useState<Person[]>([]);
  const [phase, setPhase] = useState<'loading' | 'scanning' | 'found' | 'off' | 'unsupported' | 'adapter' | 'location'>('loading');
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(0);
  const sightings = useRef(new Map<string, Sighting>());
  const running = useRef(false);

  const refreshPeople = useCallback(async () => {
    const data = await nearbyApi.nearbyUsers();
    setPeople(data.items);
    if (data.items.length) setPhase('found');
  }, []);

  const stop = useCallback(() => {
    running.current = false;
    nearbyBle.stop().catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    const batch = [...sightings.current.values()];
    sightings.current.clear();
    if (!batch.length) return;
    await nearbyApi.bleSightings(batch).catch(() => {});
    await refreshPeople().catch(() => {});
  }, [refreshPeople]);

  const run = useCallback(async () => {
    if (running.current) return;
    if (!nearbyBleAvailable()) {
      setPhase('unsupported');
      return;
    }
    if (!(await nearbyBle.supported())) {
      setPhase('unsupported');
      return;
    }
    if (!(await nearbyBle.adapterOn())) {
      setPhase('adapter');
      return;
    }
    if (Platform.OS === 'android' && Number(Platform.Version) < 31) {
      const loc = await checkPermission('location');
      if (!isUsable(loc)) {
        setPhase('location');
        return;
      }
    }
    const tokens = await nearbyApi.bleTokens();
    const eph = currentId(tokens);
    if (!eph) return;
    const started = await nearbyBle.start(eph);
    if (!started) {
      setPhase((await nearbyBle.adapterOn()) ? 'unsupported' : 'adapter');
      return;
    }
    running.current = true;
    setPhase('scanning');
    const rotate = setInterval(() => {
      const next = currentId(tokens);
      if (next) nearbyBle.updateId(next).catch(() => {});
    }, 20_000);
    const report = setInterval(() => {
      flush().catch(() => {});
    }, 30_000);
    const poll = setInterval(() => {
      refreshPeople().catch(() => {});
    }, 15_000);
    const stopTimers = () => {
      clearInterval(rotate);
      clearInterval(report);
      clearInterval(poll);
    };
    const appSub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        stopTimers();
        stop();
        setPhase('scanning');
      }
    });
    return () => {
      stopTimers();
      appSub.remove();
      stop();
    };
  }, [flush, refreshPeople, stop]);

  useFocusEffect(
    useCallback(() => {
      let cancel = () => {};
      if (settings?.enabled && settings.bluetooth_enabled && isUsable(bluetooth.status)) {
        run()
          .then(done => {
            if (done) cancel = done;
          })
          .catch(() => setPhase('unsupported'));
      } else if (settings && !settings.bluetooth_enabled) {
        setPhase('off');
      }
      const unlisten = nearbyBleEvents((ephId, rssi) => {
        const prev = sightings.current.get(ephId);
        const now = new Date().toISOString();
        sightings.current.set(ephId, {
          eph_id: ephId,
          first_seen_at: prev?.first_seen_at ?? now,
          last_seen_at: now,
          count: (prev?.count ?? 0) + 1,
          rssi_max: Math.max(prev?.rssi_max ?? -120, rssi),
        });
      });
      return () => {
        cancel();
        unlisten();
        flush().catch(() => {});
      };
    }, [bluetooth.status, flush, resume, run, settings?.bluetooth_enabled, settings?.enabled]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') setResume(n => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (people.length) setPhase('found');
  }, [people.length]);

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const status = await bluetooth.requestNow();
      if (!isUsable(status)) return;
      const next = await nearbyApi.update({
        enabled: true,
        bluetooth_enabled: true,
        timezone: deviceTimezone(),
      });
      queryClient.setQueryData(secretKeys.nearby, next);
    } finally {
      setBusy(false);
    }
  };

  const ring = 132;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Nearby" back />
      {phase === 'off' || (settings && !settings.enabled) ? (
        <EmptyState
          icon={<Bluetooth size={28} color={colors.primary} />}
          title="Find people around you"
          text="When Bluetooth is on, other Nexity people who turned this on appear in the circle. Only people nearby right now. No map and no distance."
          actionLabel="Turn on Nearby"
          onAction={turnOn}
        />
      ) : phase === 'unsupported' ? (
        <EmptyState
          icon={<Bluetooth size={28} color={colors.primary} />}
          title="This phone can't use Bluetooth Nearby"
          text="Location notifications still work from Nearby settings."
        />
      ) : phase === 'location' ? (
        <EmptyState
          icon={<Bluetooth size={28} color={colors.primary} />}
          title="Allow location"
          text="This Android version needs location permission for Bluetooth Nearby. Your place is never shown."
          actionLabel={location.status === 'blocked' ? 'Open Settings' : 'Allow location'}
          onAction={() =>
            location.status === 'blocked' ? location.openSettings() : location.requestNow().then(() => setResume(n => n + 1))
          }
        />
      ) : phase === 'adapter' ? (
        <EmptyState
          icon={<Bluetooth size={28} color={colors.primary} />}
          title="Turn on Bluetooth"
          text="Bluetooth has to be on to find people around you."
          actionLabel="Turn on Bluetooth"
          onAction={() => nearbyBle.requestEnable()}
        />
      ) : (
        <View style={styles.stage}>
          <View style={[styles.orbit, { borderColor: colors.border }]}>
            <View style={[styles.me, { backgroundColor: colors.primarySoft }]}>
              <Radar size={22} color={colors.primary} />
              <Text style={[styles.meText, { color: colors.primary }]}>You</Text>
            </View>
            {people.map((person, index) => {
              const angle = (Math.PI * 2 * index) / people.length - Math.PI / 2;
              return (
                <Pressable
                  key={person.user.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${person.user.display_name}, this person is near you`}
                  onPress={() => navigation.navigate('UserProfile', { username: person.user.username })}
                  style={[
                    styles.bubble,
                    {
                      left: 150 + Math.cos(angle) * ring - 36,
                      top: 150 + Math.sin(angle) * ring - 36,
                    },
                  ]}
                >
                  <Avatar uri={person.user.avatar_url} name={person.user.display_name} size={72} ring="unseen" />
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {person.is_premium ? '👑 ' : ''}
                    {person.user.display_name}
                  </Text>
                  <Text style={[styles.near, { color: colors.textSecondary }]}>This person is near you</Text>
                  <Button
                    title={person.follow_state === 'accepted' ? 'Following' : person.follow_state === 'pending' ? 'Requested' : 'Follow'}
                    variant="secondary"
                    disabled={person.follow_state !== 'none'}
                    onPress={() => followsApi.follow(person.user.id).then(() => refreshPeople())}
                    style={styles.follow}
                  />
                </Pressable>
              );
            })}
          </View>
          {people.length === 0 ? (
            <Text style={[styles.looking, { color: colors.textSecondary }]}>
              Looking for people who turned on Nearby…
            </Text>
          ) : null}
          <Text style={[styles.fine, { color: colors.textSecondary }]}>
            Only people who turned on Nearby appear here. Other Bluetooth devices are ignored.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', paddingTop: spacing.lg },
  orbit: {
    width: 300,
    height: 300,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  me: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  bubble: { position: 'absolute', width: 120, alignItems: 'center' },
  name: { fontSize: 13, fontWeight: '800', marginTop: 4, maxWidth: 110 },
  near: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  follow: { marginTop: 6, minHeight: 32 },
  looking: { marginTop: spacing.lg, fontSize: 14 },
  fine: { marginTop: spacing.md, marginHorizontal: spacing.lg, textAlign: 'center', fontSize: 12, lineHeight: 17 },
});
