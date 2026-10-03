import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authApi, type Me, type Session } from '@/services/api/auth';
import { ApiError, refreshAccessToken } from '@/services/api/client';
import { secureStore } from '@/services/storage/secureStore';

import { tokenStore } from './tokenStore';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: Me };

interface AuthContextValue {
  status: AuthState['status'];
  user: Me | null;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    tokenStore.setOnSessionExpired(() =>
      setState({ status: 'signedOut', user: null }),
    );
    return () => tokenStore.setOnSessionExpired(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedRefresh, cachedUser] = await Promise.all([
        secureStore.getRefreshToken(),
        secureStore.getUser<Me>(),
      ]);
      if (!storedRefresh) {
        if (!cancelled) setState({ status: 'signedOut', user: null });
        return;
      }

      tokenStore.restore(storedRefresh);
      try {
        await refreshAccessToken();
        const user = await authApi.me();
        await secureStore.setUser(user);
        if (!cancelled) setState({ status: 'signedIn', user });
      } catch (err) {
        if (cancelled) return;
        // Offline at launch: keep the user signed in with the cached profile; requests refresh later.
        if (err instanceof ApiError && err.isNetworkError && cachedUser) {
          setState({ status: 'signedIn', user: cachedUser });
          return;
        }
        await tokenStore.clear();
        setState({ status: 'signedOut', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (session: Session) => {
    await tokenStore.setTokens(session);
    await secureStore.setUser(session.user);
    setState({ status: 'signedIn', user: session.user });
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    await tokenStore.clear();
    setState({ status: 'signedOut', user: null });
    if (refreshToken) {
      // Logout always succeeds locally; the server revoke is best effort.
      authApi.logout(refreshToken).catch(() => undefined);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
