import { Platform } from 'react-native';
import {
  check,
  checkMultiple,
  checkNotifications,
  openSettings,
  PERMISSIONS,
  request,
  requestMultiple,
  requestNotifications,
  RESULTS,
} from 'react-native-permissions';

import { openPermissionSettings } from '@/features/media/permissionPrompt';
import {
  checkPhotoAccess,
  fromResult,
  type PhotoAccess,
  requestPhotoAccess,
  selectMorePhotos,
} from '@/services/media/photoPermission';

export type PermissionType =
  | 'camera'
  | 'photos'
  | 'microphone'
  | 'notifications'
  | 'location'
  | 'bluetooth';

/**
 * `limited`: only some photos are shared (iOS Limited Photos, Android 14 partial).
 * `blocked`: the OS will not show its popup again; only Settings can turn it on.
 */
export type PermissionStatus = PhotoAccess;

export const PERMISSION_COPY: Record<
  PermissionType,
  { title: string; reason: string; offTitle: string; name: string }
> = {
  camera: {
    name: 'Camera',
    title: 'Allow camera access',
    reason: 'Take photos and videos to share',
    offTitle: 'Camera access is off',
  },
  photos: {
    name: 'Photos',
    title: 'Allow photo access',
    reason: 'Choose photos and videos to post',
    offTitle: 'Photo access is off',
  },
  microphone: {
    name: 'Microphone',
    title: 'Allow microphone access',
    reason: 'Record sound with your videos',
    offTitle: 'Microphone access is off',
  },
  notifications: {
    name: 'Notifications',
    title: 'Turn on notifications',
    reason: 'Get notified about likes, follows and messages',
    offTitle: 'Notifications are off',
  },
  location: {
    name: 'Location',
    title: 'Allow location while using Nexity',
    reason:
      'Know when someone was near you today. Your place is never shown to anyone',
    offTitle: 'Location is off',
  },
  bluetooth: {
    name: 'Nearby devices',
    title: 'Allow Bluetooth',
    reason: 'Find people around you who also turned on Nearby. Other devices are ignored',
    offTitle: 'Bluetooth is off',
  },
};

export const isUsable = (status: PermissionStatus | undefined) =>
  status === 'granted' || status === 'limited';

/** What a tap on a gated action does, given the current status. */
export function firstStep(
  status: PermissionStatus,
): 'run' | 'ask' | 'settings' | 'unavailable' {
  if (isUsable(status)) return 'run';
  if (status === 'blocked') return 'settings';
  if (status === 'unavailable') return 'unavailable';
  return 'ask';
}

/** What follows the OS popup. */
export function afterRequest(
  status: PermissionStatus,
): 'run' | 'denied' | 'settings' | 'unavailable' {
  if (isUsable(status)) return 'run';
  if (status === 'blocked') return 'settings';
  if (status === 'unavailable') return 'unavailable';
  return 'denied';
}

const CAMERA = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  default: PERMISSIONS.ANDROID.CAMERA,
});
const MICROPHONE = Platform.select({
  ios: PERMISSIONS.IOS.MICROPHONE,
  default: PERMISSIONS.ANDROID.RECORD_AUDIO,
});

const ANDROID_LOCATION = [
  PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
] as const;

/** Approximate-only location (Android) is `limited`: usable, but less accurate. */
function fromAndroidLocation(
  results: Record<(typeof ANDROID_LOCATION)[number], string>,
): PermissionStatus {
  const fine = results[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
  const coarse = results[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION];
  if (fine === RESULTS.GRANTED) return 'granted';
  if (coarse === RESULTS.GRANTED) return 'limited';
  if (fine === RESULTS.BLOCKED || coarse === RESULTS.BLOCKED) return 'blocked';
  return fromResult(fine ?? coarse ?? RESULTS.DENIED);
}

const ANDROID_BLUETOOTH = [
  PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
  PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
  PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
] as const;

function fromAndroidBluetooth(
  results: Record<(typeof ANDROID_BLUETOOTH)[number], string>,
): PermissionStatus {
  const values = ANDROID_BLUETOOTH.map(name => results[name]);
  if (values.every(value => value === RESULTS.GRANTED)) return 'granted';
  if (values.some(value => value === RESULTS.BLOCKED)) return 'blocked';
  return fromResult(values.find(value => value !== RESULTS.GRANTED) ?? RESULTS.DENIED);
}

async function checkBluetooth() {
  if (Platform.OS === 'ios') {
    return fromResult(await check(PERMISSIONS.IOS.BLUETOOTH));
  }
  if (Number(Platform.Version) < 31) return 'granted';
  return fromAndroidBluetooth(await checkMultiple([...ANDROID_BLUETOOTH]));
}

async function requestBluetooth() {
  if (Platform.OS === 'ios') {
    return fromResult(await request(PERMISSIONS.IOS.BLUETOOTH));
  }
  if (Number(Platform.Version) < 31) return 'granted';
  return fromAndroidBluetooth(await requestMultiple([...ANDROID_BLUETOOTH]));
}

/** iOS Precise Location off is `limited`: Nearby cannot use a city-sized reading. */
async function withIosAccuracy(status: PermissionStatus): Promise<PermissionStatus> {
  if (Platform.OS !== 'ios' || status !== 'granted') return status;
  try {
    const geo = require('react-native-nitro-geolocation') as typeof import('react-native-nitro-geolocation');
    const details = await geo.getPermissionDetails();
    if (details.accuracy === 'reduced') return 'limited';
  } catch {
    // The When-In-Use grant still stands if the accuracy read fails.
  }
  return status;
}

async function checkLocation() {
  if (Platform.OS === 'ios') {
    return withIosAccuracy(fromResult(await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)));
  }
  return fromAndroidLocation(await checkMultiple([...ANDROID_LOCATION]));
}

async function requestLocation() {
  if (Platform.OS === 'ios') {
    return withIosAccuracy(fromResult(await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)));
  }
  return fromAndroidLocation(await requestMultiple([...ANDROID_LOCATION]));
}

/** Current status. Never shows a popup. */
async function checkNative(type: PermissionType): Promise<PermissionStatus> {
  switch (type) {
    case 'photos':
      return checkPhotoAccess();
    case 'notifications':
      return fromResult((await checkNotifications()).status);
    case 'camera':
      return fromResult(await check(CAMERA));
    case 'microphone':
      return fromResult(await check(MICROPHONE));
    case 'location':
      return checkLocation();
    case 'bluetooth':
      return checkBluetooth();
  }
}

/** Shows the OS popup when the OS still allows it. */
async function requestNative(type: PermissionType): Promise<PermissionStatus> {
  switch (type) {
    case 'photos':
      return requestPhotoAccess();
    case 'notifications':
      return fromResult(
        (await requestNotifications(['alert', 'sound', 'badge'])).status,
      );
    case 'camera':
      return fromResult(await request(CAMERA));
    case 'microphone':
      return fromResult(await request(MICROPHONE));
    case 'location':
      return requestLocation();
    case 'bluetooth':
      return requestBluetooth();
  }
}

export type PermissionState = {
  status: PermissionStatus | undefined;
  /** The OS popup was shown (or refused to show) this session. */
  asked: boolean;
};

const UNKNOWN: PermissionState = { status: undefined, asked: false };
const states: Partial<Record<PermissionType, PermissionState>> = {};
/**
 * Android `check` reports a permanent deny as plain `denied`, so a `blocked`
 * answer from `request` is remembered until access is turned on.
 */
const blocked = new Set<PermissionType>();
const listeners = new Set<() => void>();

export function subscribePermissions(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getPermissionState = (type: PermissionType) =>
  states[type] ?? UNKNOWN;

function record(type: PermissionType, raw: PermissionStatus, asked?: boolean) {
  if (raw === 'blocked') blocked.add(type);
  if (isUsable(raw)) blocked.delete(type);
  const status = raw === 'denied' && blocked.has(type) ? 'blocked' : raw;
  const prev = getPermissionState(type);
  const next = { status, asked: prev.asked || !!asked };
  if (prev.status !== next.status || prev.asked !== next.asked) {
    states[type] = next;
    listeners.forEach(l => l());
  }
  return status;
}

export async function checkPermission(type: PermissionType) {
  const raw = await checkNative(type).catch(() => 'unavailable' as const);
  return record(type, raw);
}

export async function requestPermission(type: PermissionType) {
  const raw = await requestNative(type).catch(() => 'unavailable' as const);
  return record(type, raw, true);
}

/** Opens the page holding this permission's switch (falls back to app settings). */
export async function openSettingsFor(type: PermissionType) {
  if (type === 'notifications') {
    await openSettings('notifications').catch(() => openSettings());
    return;
  }
  if (type === 'bluetooth') {
    await openSettings();
    return;
  }
  await openPermissionSettings(type);
}

/** Limited access: lets the user change which photos are shared. */
export async function managePhotoSelection() {
  return record('photos', await selectMorePhotos().catch(() => 'limited' as const));
}
