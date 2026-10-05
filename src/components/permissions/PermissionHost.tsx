import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  allowPending,
  dismissPending,
  getPending,
  openSettingsForPending,
  type PendingPermission,
  recheckPending,
  subscribePending,
} from '@/features/permissions/permissionFlow';
import {
  checkPermission,
  getPermissionState,
  type PermissionType,
} from '@/features/permissions/permissions';
import { ThemeScope } from '@/theme/ThemeProvider';

import { PermissionSheet } from './PermissionSheet';

const TYPES: PermissionType[] = ['camera', 'photos', 'microphone', 'notifications'];

/**
 * Render once at the app root. Shows the permission sheet for `usePermission().request`
 * and re-checks permissions whenever the app returns to the foreground.
 */
export function PermissionHost() {
  const pending = useSyncExternalStore(subscribePending, getPending);
  // Keep the last request on screen while the sheet animates out.
  const [shown, setShown] = useState<PendingPermission | null>(pending);
  if (pending && pending !== shown) setShown(pending);

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      const wasAway = appState.current !== 'active';
      appState.current = next;
      if (next !== 'active' || !wasAway) return;
      TYPES.forEach(type => {
        if (getPermissionState(type).status !== undefined) {
          checkPermission(type).catch(() => {});
        }
      });
      recheckPending().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!shown) return null;

  return (
    <ThemeScope theme={shown.theme}>
      <PermissionSheet
        visible={!!pending}
        type={shown.type}
        phase={shown.phase}
        busy={shown.busy}
        onPrimary={() => {
          if (shown.phase === 'blocked') openSettingsForPending();
          else allowPending();
        }}
        onClose={dismissPending}
      />
    </ThemeScope>
  );
}
