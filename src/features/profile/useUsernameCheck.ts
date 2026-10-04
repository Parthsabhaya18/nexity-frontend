import { useEffect, useState } from 'react';

import { USERNAME_PATTERN } from '@/features/auth/schemas';
import { authApi } from '@/services/api/auth';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

const DEBOUNCE_MS = 450;

/** Live availability while typing; the user's current username counts as `idle`. */
export function useUsernameCheck(value: string, current: string) {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const username = value.trim().toLowerCase();

  useEffect(() => {
    if (username === current || !USERNAME_PATTERN.test(username)) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.usernameAvailable(username);
        if (!cancelled) setStatus(res.available ? 'available' : 'taken');
      } catch {
        // Offline or rate limited: the server checks again on save.
        if (!cancelled) setStatus('idle');
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, current]);

  return status;
}
