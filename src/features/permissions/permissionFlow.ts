import { showToast } from '@/components/ui/Toast';
import type { AppTheme } from '@/theme';

import {
  afterRequest,
  checkPermission,
  firstStep,
  getPermissionState,
  isUsable,
  openSettingsFor,
  PERMISSION_COPY,
  type PermissionStatus,
  type PermissionType,
  requestPermission,
} from './permissions';

/** `ask`: our pre-permission sheet. `denied`: Try again. `blocked`: Open Settings. */
export type SheetPhase = 'ask' | 'denied' | 'blocked';

export type PendingPermission = {
  id: number;
  type: PermissionType;
  phase: SheetPhase;
  busy: boolean;
  theme: AppTheme | null;
};

type Internal = PendingPermission & {
  action?: () => void;
  resolve: (status: PermissionStatus) => void;
  /** Open Settings was tapped; returning to the app re-checks. */
  awaitingSettings: boolean;
};

/** Lets the sheet finish closing before the action opens a picker or screen (iOS). */
const AFTER_CLOSE_MS = 300;

let pending: Internal | null = null;
let snapshot: PendingPermission | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Internal | null) {
  pending = next;
  snapshot = next
    ? {
        id: next.id,
        type: next.type,
        phase: next.phase,
        busy: next.busy,
        theme: next.theme,
      }
    : null;
  listeners.forEach(l => l());
}

export function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getPending = () => snapshot;

function finish(status: PermissionStatus, run: boolean) {
  const done = pending;
  if (!done) return;
  publish(null);
  done.resolve(status);
  if (run && done.action) setTimeout(done.action, AFTER_CLOSE_MS);
}

function unavailable(type: PermissionType) {
  showToast(
    `${PERMISSION_COPY[type].name} isn't available on this device`,
    'error',
  );
}

/**
 * Runs `action` once `type` is allowed. Shows our sheet before the OS popup,
 * then Try again or Open Settings when refused. Resolves with the final status
 * (also when the user taps Not now).
 */
export async function runWithPermission(
  type: PermissionType,
  action?: () => void,
  theme: AppTheme | null = null,
): Promise<PermissionStatus> {
  if (pending) finish(getPermissionState(pending.type).status ?? 'denied', false);

  const status = await checkPermission(type);
  const step = firstStep(status);
  if (step === 'run') {
    action?.();
    return status;
  }
  if (step === 'unavailable') {
    unavailable(type);
    return status;
  }
  return new Promise(resolve => {
    publish({
      id: nextId++,
      type,
      phase: step === 'settings' ? 'blocked' : 'ask',
      busy: false,
      theme,
      action,
      resolve,
      awaitingSettings: false,
    });
  });
}

/** Allow / Try again: shows the OS popup. */
export async function allowPending() {
  const current = pending;
  if (!current || current.busy) return;
  publish({ ...current, busy: true });
  const status = await requestPermission(current.type);
  if (pending?.id !== current.id) return;
  const step = afterRequest(status);
  if (step === 'run') return finish(status, true);
  if (step === 'unavailable') {
    finish(status, false);
    return unavailable(current.type);
  }
  publish({
    ...current,
    busy: false,
    phase: step === 'settings' ? 'blocked' : 'denied',
  });
}

export async function openSettingsForPending() {
  if (!pending) return;
  publish({ ...pending, awaitingSettings: true });
  await openSettingsFor(pending.type).catch(() => {});
}

/** Called when the app returns to the foreground. */
export async function recheckPending() {
  const current = pending;
  if (!current?.awaitingSettings) return;
  const status = await checkPermission(current.type);
  if (pending?.id !== current.id) return;
  if (isUsable(status)) finish(status, true);
}

/** Not now, backdrop tap or Android back. */
export function dismissPending() {
  if (!pending) return;
  finish(getPermissionState(pending.type).status ?? 'denied', false);
}
