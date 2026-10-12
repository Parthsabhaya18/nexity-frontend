import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  getCurrentPosition,
  hasServicesEnabled,
  setConfiguration,
} from 'react-native-nitro-geolocation';

import { useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/features/entities/entityCache';
import {
  checkPermission,
  getPermissionState,
  subscribePermissions,
} from '@/features/permissions/permissions';
import { deviceTimezone } from '@/features/secret/format';
import { secretKeys, useNearbySettings } from '@/features/secret/secretQueries';
import { ApiError } from '@/services/api/client';
import { nearbyApi } from '@/services/api/nearby';

import { ensurePreciseLocation } from './preciseLocation';

const MIN_SAMPLE_SECONDS = 60;
let configured = false;

function configureOnce() {
  if (configured) return;
  configured = true;
  // Foreground only: Nearby never tracks in the background.
  setConfiguration({
    authorizationLevel: 'whenInUse',
    enableBackgroundLocationUpdates: false,
    locationProvider: 'auto',
  });
}

const isActive = () => {
  const s = AppState.currentState;
  return s === 'active' || s == null || (s as string) === 'unknown';
};

/**
 * While Nearby location is on and the app is open, sends one rounded location sample
 * every couple of minutes so the server can spot people who were near each other.
 */
export function NearbyLocationHost() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const settings = useNearbySettings(signedIn).data;
  const permission = useSyncExternalStore(subscribePermissions, () =>
    getPermissionState('location'),
  ).status;
  const [foreground, setForeground] = useState(isActive);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next =>
      setForeground(next === 'active'),
    );
    return () => sub.remove();
  }, []);

  const enabled = signedIn && !!settings?.enabled;

  useEffect(() => {
    if (enabled) checkPermission('location').catch(() => {});
  }, [enabled, foreground]);

  // Today / yesterday hints use the calendar day of the phone's time zone.
  const savedTimezone = settings?.timezone;
  useEffect(() => {
    if (!enabled || !savedTimezone) return;
    const tz = deviceTimezone();
    if (tz === savedTimezone) return;
    nearbyApi
      .update({ timezone: tz })
      .then(next => queryClient.setQueryData(secretKeys.nearby, next))
      .catch(() => {});
  }, [enabled, savedTimezone]);

  const running =
    enabled &&
    foreground &&
    !!settings?.location_enabled &&
    !!settings?.feature_available &&
    permission === 'granted';
  const sampleSeconds = Math.max(
    MIN_SAMPLE_SECONDS,
    settings?.location_sample_seconds ?? 120,
  );
  const accuracyLimit = settings?.location_accuracy_limit_m ?? 40;
  const askedPrecise = useRef(false);

  useEffect(() => {
    if (!enabled || !foreground || permission !== 'limited' || !settings?.location_enabled) return;
    if (askedPrecise.current) return;
    askedPrecise.current = true;
    ensurePreciseLocation().catch(() => {});
  }, [enabled, foreground, permission, settings?.location_enabled]);

  useEffect(() => {
    if (!running) return;
    configureOnce();
    let cancelled = false;
    let busy = false;

    const sample = async () => {
      if (busy) return;
      busy = true;
      try {
        if (!(await hasServicesEnabled())) return;
        const pos = await getCurrentPosition({
          accuracy: { android: 'high', ios: 'best' },
          timeout: 20_000,
          maximumAge: 30_000,
        });
        if (cancelled || !(pos.coords.accuracy <= accuracyLimit)) return;
        await nearbyApi.sendLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy),
          captured_at: new Date(pos.timestamp || Date.now()).toISOString(),
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NEARBY_DISABLED') {
          queryClient.invalidateQueries({ queryKey: secretKeys.nearby });
        }
      } finally {
        busy = false;
      }
    };

    sample();
    const timer = setInterval(sample, sampleSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [running, sampleSeconds, accuracyLimit]);

  return null;
}
