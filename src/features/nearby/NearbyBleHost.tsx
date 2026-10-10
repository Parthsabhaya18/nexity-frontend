import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { onSocketEvent } from '@/features/chats/chatController';
import { queryClient } from '@/features/entities/entityCache';
import { checkPermission, isUsable } from '@/features/permissions/permissions';
import { secretKeys, useNearbySettings } from '@/features/secret/secretQueries';
import { nearbyApi } from '@/services/api/nearby';

import { nearbyBle, nearbyBleAvailable, nearbyBleEvents } from './ble';

type Token = { eph_id: string; valid_from: string; valid_until: string };
type Sighting = {
  eph_id: string;
  first_seen_at: string;
  last_seen_at: string;
  count: number;
  rssi_max: number;
};

const currentId = (items: Token[]) => {
  const now = Date.now();
  const live = items.find(item => now >= Date.parse(item.valid_from) && now < Date.parse(item.valid_until));
  if (live) return live.eph_id;
  const soonest = [...items].sort((a, b) => Date.parse(a.valid_from) - Date.parse(b.valid_from))[0];
  return soonest?.eph_id ?? null;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Keeps Bluetooth Nearby running for the whole sign-in, including when Nexity
 * is in the background. The Nearby screen only draws the result.
 */
export function NearbyBleHost() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const settings = useNearbySettings(signedIn).data;
  const enabled = signedIn && !!settings?.enabled && !!settings.bluetooth_enabled;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !nearbyBleAvailable()) return;
    let stopped = false;
    const tokens: Token[] = [];
    const sightings = new Map<string, Sighting>();
    let advertised = '';
    let lastFlush = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let flushDelay = 0;
    const sent = new Set<string>();

    const flush = async () => {
      const batch = [...sightings.values()];
      if (!batch.length) return;
      try {
        await nearbyApi.bleSightings(batch);
        for (const row of batch) {
          const current = sightings.get(row.eph_id);
          if (current && current.count === row.count && current.last_seen_at === row.last_seen_at) {
            sightings.delete(row.eph_id);
          }
        }
        for (const row of batch) sent.add(row.eph_id);
        lastFlush = Date.now();
        queryClient.invalidateQueries({ queryKey: secretKeys.nearbyUsers }).catch(() => {});
        if ([...sightings.keys()].some(id => !sent.has(id))) scheduleFlush(40);
      } catch {
        if (!stopped) scheduleFlush(400);
      }
    };

    const scheduleFlush = (delay: number) => {
      if (stopped) return;
      if (flushTimer && delay >= flushDelay) return;
      if (flushTimer) clearTimeout(flushTimer);
      flushDelay = delay;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush().catch(() => {});
      }, delay);
    };

    const noteSighting = (ephId: string, rssi: number) => {
      const prev = sightings.get(ephId);
      const now = new Date().toISOString();
      sightings.set(ephId, {
        eph_id: ephId,
        first_seen_at: prev?.first_seen_at ?? now,
        last_seen_at: now,
        count: (prev?.count ?? 0) + 1,
        rssi_max: Math.max(prev?.rssi_max ?? -120, rssi),
      });
      const repeat = sent.has(ephId) && Date.now() - lastFlush < 3000;
      scheduleFlush(repeat ? 3000 - (Date.now() - lastFlush) : 40);
    };

    const publish = async () => {
      const next = currentId(tokens);
      if (!next || next === advertised || stopped) return;
      const ok = advertised
        ? await nearbyBle.updateId(next).catch(() => false)
        : await nearbyBle.start(next).catch(() => false);
      if (ok) advertised = next;
    };

    const ensureTokens = async () => {
      const fresh = currentId(tokens);
      const expiresSoon =
        fresh != null &&
        tokens.some(item => item.eph_id === fresh && Date.parse(item.valid_until) - Date.now() < 60_000);
      if (fresh && !expiresSoon) return;
      const next = await nearbyApi.bleTokens();
      tokens.splice(0, tokens.length, ...next);
    };

    const ready = async () => {
      const bt = await checkPermission('bluetooth');
      if (!isUsable(bt)) return false;
      if (Platform.OS === 'android' && (Number(Platform.Version) < 31 || (await nearbyBle.scanNeedsLocation()))) {
        const loc = await checkPermission('location');
        if (!isUsable(loc) || (await nearbyBle.locationOff())) return false;
      }
      return nearbyBle.adapterOn();
    };

    const unlisten = nearbyBleEvents(noteSighting);
    const unlistenLive = onSocketEvent('nearby.updated', () => {
      queryClient.invalidateQueries({ queryKey: secretKeys.nearbyUsers }).catch(() => {});
    });

    const run = async () => {
      while (!stopped && enabledRef.current) {
        try {
          if (await ready()) {
            await ensureTokens();
            await publish();
          }
        } catch {
          // The next pass retries. A failed report stays in the sighting map.
        }
        await sleep(advertised ? 15_000 : 1500);
      }
    };

    void run();

    const sub = AppState.addEventListener('change', () => {
      if (AppState.currentState === 'active') publish().catch(() => {});
    });

    return () => {
      stopped = true;
      sub.remove();
      unlisten();
      unlistenLive();
      if (flushTimer) clearTimeout(flushTimer);
      nearbyBle.stop().catch(() => {});
    };
  }, [enabled]);

  return null;
}
