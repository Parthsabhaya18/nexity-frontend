import { Platform } from 'react-native';
import { requestTemporaryFullAccuracy } from 'react-native-nitro-geolocation';

import { checkPermission, type PermissionStatus } from '@/features/permissions/permissions';

/** Matches `NSLocationTemporaryUsageDescriptionDictionary` in Info.plist. */
export const PRECISE_PURPOSE = 'NearbyPrecise';

/** Asks iOS for precise location when the user chose Approximate. Android is unchanged. */
export async function ensurePreciseLocation(): Promise<PermissionStatus> {
  if (Platform.OS === 'ios') {
    try {
      await requestTemporaryFullAccuracy(PRECISE_PURPOSE);
    } catch {
      // Settings still holds the Precise Location switch.
    }
  }
  return checkPermission('location');
}
