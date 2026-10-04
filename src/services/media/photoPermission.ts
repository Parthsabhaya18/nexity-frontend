import { Platform } from 'react-native';
import {
  check,
  checkMultiple,
  openPhotoPicker,
  openSettings,
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';

/** `limited`: the user shared only some photos (iOS 14+, Android 14+). */
export type PhotoAccess = 'granted' | 'limited' | 'denied' | 'blocked' | 'unavailable';

const androidVersion = Platform.OS === 'android' ? Number(Platform.Version) : 0;

function fromResult(result: string): PhotoAccess {
  switch (result) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.LIMITED:
      return 'limited';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    default:
      return 'denied';
  }
}

const ANDROID_14 = [
  PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
  PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
  PERMISSIONS.ANDROID.READ_MEDIA_VISUAL_USER_SELECTED,
];
/** Android 13 asks for photos and videos together in one "Photos and videos" prompt. */
const ANDROID_13 = [PERMISSIONS.ANDROID.READ_MEDIA_IMAGES, PERMISSIONS.ANDROID.READ_MEDIA_VIDEO];

function fromAndroid14(results: Record<string, string>): PhotoAccess {
  const full = results[PERMISSIONS.ANDROID.READ_MEDIA_IMAGES];
  const partial = results[PERMISSIONS.ANDROID.READ_MEDIA_VISUAL_USER_SELECTED];
  if (full === RESULTS.GRANTED) return 'granted';
  if (partial === RESULTS.GRANTED) return 'limited';
  return fromResult(full ?? RESULTS.DENIED);
}

const singlePermission = () =>
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.PHOTO_LIBRARY
    : androidVersion >= 33
      ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
      : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

/** Current access without prompting. */
export async function checkPhotoAccess(): Promise<PhotoAccess> {
  if (androidVersion >= 34) return fromAndroid14(await checkMultiple(ANDROID_14));
  if (androidVersion === 33) return fromAndroid14(await checkMultiple(ANDROID_13));
  return fromResult(await check(singlePermission()));
}

/** Prompts if the OS still allows it. */
export async function requestPhotoAccess(): Promise<PhotoAccess> {
  if (androidVersion >= 34) return fromAndroid14(await requestMultiple(ANDROID_14));
  if (androidVersion === 33) return fromAndroid14(await requestMultiple(ANDROID_13));
  return fromResult(await request(singlePermission()));
}

/** Lets a user on limited access pick more photos. */
export async function selectMorePhotos(): Promise<PhotoAccess> {
  if (Platform.OS === 'ios') {
    await openPhotoPicker();
    return checkPhotoAccess();
  }
  return requestPhotoAccess();
}

export const openAppSettings = () => openSettings().catch(() => undefined);
