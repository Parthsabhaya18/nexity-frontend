import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Bluetooth, Radar } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { queryClient } from '@/features/entities/entityCache';
import { nearbyBle, nearbyBleAvailable, waitForBluetooth } from '@/features/nearby/ble';
import { checkPermission, isUsable, requestPermission } from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { deviceTimezone } from '@/features/secret/format';
import { secretKeys, useNearbyPeople, useNearbySettings } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { nearbyApi } from '@/services/api/nearby';
import { followsApi } from '@/services/api/follows';
import { radius, spacing, useAppTheme } from '@/theme';

type Person = Awaited<ReturnType<typeof nearbyApi.nearbyUsers>>['items'][number];

function SearchRadar({ active, color }: { active: boolean; color: string }) {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const ringC = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) return;
    const rings = [ringA, ringB, ringC];
    const loops = rings.map(ring =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    const starts = loops.map((loop, index) => setTimeout(() => loop.start(), index * 700));
    const spin = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      starts.forEach(clearTimeout);
      loops.forEach(loop => loop.stop());
      spin.stop();
    };
  }, [active, reduceMotion, ringA, ringB, ringC, sweep]);

  const spin = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rings = [ringA, ringB, ringC].map(ring => ({
    scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.22, 1] }),
    opacity: ring.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.55, 0] }),
  }));

  return (
    <View pointerEvents="none" style={styles.radar}>
      {active
        ? rings.map((ring, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ring,
                { borderColor: color, opacity: reduceMotion ? 0.35 : ring.opacity, transform: [{ scale: reduceMotion ? 1 : ring.scale }] },
              ]}
            />
          ))
        : null}
      {active && !reduceMotion ? (
        <Animated.View style={[styles.sweep, { backgroundColor: color, transform: [{ rotate: spin }] }]} />
      ) : null}
    </View>
  );
}

export function NearbyScreen({ navigation }: ScreenProps<'Nearby'>) {
  const { colors } = useAppTheme();
  useStatusBar();
  const focused = useIsFocused();
  const settingsQ = useNearbySettings();
  const settings = settingsQ.data;
  const nearbyOn = !!settings?.enabled && !!settings.bluetooth_enabled;
  const peopleQ = useNearbyPeople(focused && nearbyOn);
  const people = peopleQ.data?.items ?? [];
  const bluetooth = usePermission('bluetooth');
  const location = usePermission('location');
  const [phase, setPhase] = useState<'live' | 'off'>('live');
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(0);
  const asked = useRef({ bluetooth: false, location: false, place: false, radio: false, notes: false });

  const needsLocation = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    if (Number(Platform.Version) < 31) return true;
    return nearbyBle.scanNeedsLocation();
  }, []);

  /** Asks once for each missing permission or switch, then returns whether Nearby can run. */
  const prepare = useCallback(async (force = false) => {
    if (force) asked.current = { bluetooth: false, location: false, place: false, radio: false, notes: false };
    let bt = await checkPermission('bluetooth');
    if (!isUsable(bt)) {
      if (!asked.current.bluetooth) {
        asked.current.bluetooth = true;
        if (bt === 'blocked') {
          bluetooth.openSettings();
          return false;
        }
        bt = await bluetooth.requestNow();
      }
      if (!isUsable(bt)) return false;
    }
    if (await needsLocation()) {
      let loc = await checkPermission('location');
      if (!isUsable(loc)) {
        if (!asked.current.location) {
          asked.current.location = true;
          if (loc === 'blocked') {
            location.openSettings();
            return false;
          }
          loc = await location.requestNow();
        }
        if (!isUsable(loc)) return false;
      }
      if (await nearbyBle.locationOff()) {
        if (!asked.current.place) {
          asked.current.place = true;
          await nearbyBle.openLocationSettings();
        }
        return false;
      }
    }
    if (!asked.current.notes) {
      asked.current.notes = true;
      const notes = await checkPermission('notifications');
      if (!isUsable(notes) && notes !== 'blocked') await requestPermission('notifications');
    }
    if (nearbyBleAvailable() && !(await nearbyBle.adapterOn())) {
      if (!asked.current.radio) {
        asked.current.radio = true;
        await nearbyBle.requestEnable();
        return waitForBluetooth();
      }
      return false;
    }
    return true;
  }, [bluetooth, location, needsLocation]);

  useFocusEffect(
    useCallback(() => {
      if (!settings) return;
      if (!settings.enabled || !settings.bluetooth_enabled) {
        setPhase('off');
        return;
      }
      prepare()
        .then(ready => setPhase(ready ? 'live' : 'off'))
        .catch(() => setPhase('off'));
    }, [prepare, resume, settings]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') setResume(n => n + 1);
    });
    return () => sub.remove();
  }, []);

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await prepare(true))) return;
      const next = await nearbyApi.update({
        enabled: true,
        bluetooth_enabled: true,
        timezone: deviceTimezone(),
      });
      queryClient.setQueryData(secretKeys.nearby, next);
      setPhase('live');
      setResume(n => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const refreshPeople = () => {
    queryClient.invalidateQueries({ queryKey: secretKeys.nearbyUsers }).catch(() => {});
  };

  const searching = people.length === 0;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Nearby" back />
      {phase === 'off' || (settings && !settings.enabled) ? (
        <EmptyState
          icon={<Bluetooth size={28} color={colors.primary} />}
          title="Nearby"
          actionLabel="Turn on"
          onAction={turnOn}
        />
      ) : searching ? (
        <View style={styles.stage}>
          <View style={[styles.orbit, { borderColor: colors.border }]}>
            <SearchRadar active color={colors.primary} />
            <View style={[styles.me, { backgroundColor: colors.primarySoft }]}>
              <Radar size={22} color={colors.primary} />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {people.map((person: Person) => (
            <Pressable
              key={person.user.id}
              accessibilityRole="button"
              accessibilityLabel={person.user.display_name}
              onPress={() => navigation.navigate('UserProfile', { username: person.user.username })}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Avatar uri={person.user.avatar_url} name={person.user.display_name} size={48} ring="unseen" />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {person.is_premium ? '👑 ' : ''}
                {person.user.display_name}
              </Text>
              <Button
                title={person.follow_state === 'accepted' ? 'Following' : person.follow_state === 'pending' ? 'Requested' : 'Follow'}
                variant="secondary"
                disabled={person.follow_state !== 'none'}
                onPress={() => followsApi.follow(person.user.id).then(refreshPeople)}
                style={styles.follow}
              />
            </Pressable>
          ))}
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
    overflow: 'visible',
  },
  radar: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  sweep: {
    width: 260,
    height: 2,
    borderRadius: 1,
    opacity: 0.5,
  },
  me: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  follow: { minHeight: 36, paddingHorizontal: spacing.md },
});
