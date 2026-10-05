import { showToast } from '@/components/ui/Toast';
import { ApiError } from '@/services/api/client';

/** Bumped by every change to an entity, so an old failure never undoes a newer tap. */
const versions = new Map<string, number>();

export function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export type OptimisticResult<T> = { ok: true; result: T } | { ok: false };

/**
 * Applies a change at once, then runs the request. On failure the change is
 * undone (unless something newer touched the same entity) and an error toast
 * explains it. Never rejects.
 */
export async function runOptimistic<T>({
  key,
  apply,
  run,
  commit,
  errorMessage = "Couldn't update. Please try again.",
}: {
  /** Entity the change belongs to, e.g. `relation:<userId>`. */
  key: string;
  /** Writes the optimistic state and returns how to undo it. */
  apply: () => () => void;
  run: () => Promise<T>;
  /** Writes what the server answered. Skipped when a newer change is pending. */
  commit?: (result: T) => void;
  errorMessage?: string;
}): Promise<OptimisticResult<T>> {
  const version = (versions.get(key) ?? 0) + 1;
  versions.set(key, version);
  const undo = apply();
  try {
    const result = await run();
    if (versions.get(key) === version) commit?.(result);
    return { ok: true, result };
  } catch (err) {
    if (versions.get(key) === version) undo();
    showToast(errorText(err, errorMessage), 'error');
    return { ok: false };
  } finally {
    if (versions.get(key) === version) versions.delete(key);
  }
}
