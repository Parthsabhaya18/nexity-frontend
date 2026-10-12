import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useAppTheme } from '@/theme';

import { runWithPermission } from './permissionFlow';
import {
  checkPermission,
  getPermissionState,
  isUsable,
  managePhotoSelection,
  openSettingsFor,
  type PermissionType,
  requestPermission,
  subscribePermissions,
} from './permissions';

/**
 * Live status of one permission (re-checked when the app returns to the
 * foreground) plus the gated `request(action)` flow.
 */
export function usePermission(type: PermissionType) {
  const theme = useAppTheme();
  const { status, asked } = useSyncExternalStore(subscribePermissions, () =>
    getPermissionState(type),
  );

  useEffect(() => {
    checkPermission(type).catch(() => {});
  }, [type]);

  /** Runs `action` when allowed; shows our sheet, then the OS popup, when not. */
  const request = useCallback(
    (action?: () => void) => runWithPermission(type, action, theme),
    [type, theme],
  );

  return {
    status,
    asked,
    granted: isUsable(status),
    limited: status === 'limited',
    request,
    /** OS popup directly, for screens whose empty state already explains why. */
    requestNow: useCallback(() => requestPermission(type), [type]),
    check: useCallback(() => checkPermission(type), [type]),
    openSettings: useCallback(() => openSettingsFor(type), [type]),
    /** Limited Photos: change which photos are shared. */
    manage: managePhotoSelection,
  };
}
