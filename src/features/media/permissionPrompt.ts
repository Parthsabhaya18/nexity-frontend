import {
  Alert,
  Linking,
  type Permission,
  PermissionsAndroid,
  Platform,
} from 'react-native';

/** Same id as the Android applicationId and the iOS bundle. */
const ANDROID_PACKAGE = 'com.nexity.app';

export type PermissionKind = 'photos' | 'camera' | 'microphone' | 'location';

/** `blocked`: the system will not ask again, so only Settings can turn it on. */
export type AccessResult = 'granted' | 'denied' | 'blocked';

const SWITCHES: Record<PermissionKind, string> = {
  photos: 'Photos',
  camera: 'Camera',
  microphone: 'Microphone',
  location: 'Location',
};

/** The Settings group that holds this switch. Camera opens Camera, and so on. */
export function androidPermissionGroup(kind: PermissionKind, api: number) {
  if (kind === 'photos') {
    return api >= 33
      ? 'android.permission-group.READ_MEDIA_VISUAL'
      : 'android.permission-group.STORAGE';
  }
  if (kind === 'camera') return 'android.permission-group.CAMERA';
  if (kind === 'microphone') return 'android.permission-group.MICROPHONE';
  return 'android.permission-group.LOCATION';
}

/** The Android permission whose switch this kind turns on. */
export function androidPermissionName(kind: PermissionKind, api: number) {
  if (kind === 'photos') {
    return api >= 33
      ? 'android.permission.READ_MEDIA_IMAGES'
      : 'android.permission.READ_EXTERNAL_STORAGE';
  }
  if (kind === 'camera') return 'android.permission.CAMERA';
  if (kind === 'microphone') return 'android.permission.RECORD_AUDIO';
  return 'android.permission.ACCESS_FINE_LOCATION';
}

function androidPermissionNames(kind: PermissionKind, api: number) {
  if (kind === 'location') {
    return [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ] as Permission[];
  }
  if (kind !== 'photos')
    return [androidPermissionName(kind, api) as Permission];
  if (api >= 33) {
    return [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      ...(api >= 34
        ? ['android.permission.READ_MEDIA_VISUAL_USER_SELECTED']
        : []),
    ] as Permission[];
  }
  return ['android.permission.READ_EXTERNAL_STORAGE'] as Permission[];
}

/** Photos and location count as on when any one of their switches is on. */
const anyOneIsEnough = (kind: PermissionKind) =>
  kind === 'photos' || kind === 'location';

/** True when this access is already on. Never shows a dialog. */
export async function accessGranted(kind: PermissionKind) {
  if (Platform.OS !== 'android') return true;
  const names = androidPermissionNames(kind, Number(Platform.Version));
  const checks = await Promise.all(
    names.map(name => PermissionsAndroid.check(name).catch(() => false)),
  );
  return anyOneIsEnough(kind) ? checks.some(Boolean) : checks.every(Boolean);
}

/**
 * Shows the phone's own permission dialog when the app may still ask.
 * iOS libraries (camera, photo library, image picker) show theirs by
 * themselves, so on iOS this only reports `granted` and lets them ask.
 */
export async function requestAccess(
  kind: PermissionKind,
): Promise<AccessResult> {
  if (Platform.OS !== 'android') return 'granted';
  if (await accessGranted(kind)) return 'granted';
  const names = androidPermissionNames(kind, Number(Platform.Version));
  const result = await PermissionsAndroid.requestMultiple(names).catch(
    () => ({} as Record<string, string>),
  );
  const values = names.map(name => result[name]);
  const granted = (v: string | undefined) =>
    v === PermissionsAndroid.RESULTS.GRANTED;
  const ok = anyOneIsEnough(kind)
    ? values.some(granted)
    : values.every(granted);
  if (ok) return 'granted';
  return values.some(v => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
    ? 'blocked'
    : 'denied';
}

export function permissionMessage(kind: PermissionKind, os: 'ios' | 'android') {
  const toggle = SWITCHES[kind];
  const where =
    os === 'ios'
      ? 'Settings opens on Nexity. Turn the switch on, then come back.'
      : `Settings opens on the ${toggle} switch. Turn it on, then come back.`;
  return `${toggle} is turned off for Nexity. ${where}`;
}

function permissionPageUrl(
  targetPackage: string,
  group: string,
  permission: string,
) {
  return (
    'intent:#Intent;' +
    'action=android.intent.action.MANAGE_APP_PERMISSION;' +
    `package=${targetPackage};` +
    `S.android.intent.extra.PACKAGE_NAME=${ANDROID_PACKAGE};` +
    `S.android.intent.extra.PERMISSION_GROUP_NAME=${group};` +
    `S.android.intent.extra.PERMISSION_NAME=${permission};` +
    'end'
  );
}

/** Opens the page where that permission’s switch lives. */
export async function openPermissionSettings(kind: PermissionKind = 'photos') {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
    return;
  }
  const api = Number(Platform.Version);
  const permission = androidPermissionName(kind, api);
  const group = androidPermissionGroup(kind, api);
  const pkg = {
    key: 'android.intent.extra.PACKAGE_NAME',
    value: ANDROID_PACKAGE,
  };
  for (const target of [
    'com.google.android.permissioncontroller',
    'com.android.permissioncontroller',
  ]) {
    try {
      await Linking.openURL(permissionPageUrl(target, group, permission));
      return;
    } catch {
      // This phone uses a different permission screen.
    }
  }
  try {
    await Linking.sendIntent('android.intent.action.MANAGE_APP_PERMISSIONS', [
      pkg,
    ]);
  } catch {
    await Linking.openSettings();
  }
}

let showing = false;

/** Only after a permanent "Don't allow": one popup, Not now or Open Settings. */
export function showPermissionPrompt(kind: PermissionKind) {
  if (showing) return;
  showing = true;
  const close = () => {
    showing = false;
  };
  Alert.alert(
    `Allow ${SWITCHES[kind].toLowerCase()}`,
    permissionMessage(kind, Platform.OS === 'ios' ? 'ios' : 'android'),
    [
      { text: 'Not now', style: 'cancel', onPress: close },
      {
        text: 'Open Settings',
        onPress: () => {
          close();
          openPermissionSettings(kind).catch(() => {});
        },
      },
    ],
    { onDismiss: close },
  );
}

/**
 * Asks with the phone's dialog first. Settings is offered only when the
 * phone will no longer ask. Returns whether access is on.
 */
export async function ensureAccess(kind: PermissionKind) {
  const result = await requestAccess(kind);
  if (result === 'blocked') showPermissionPrompt(kind);
  return result === 'granted';
}
