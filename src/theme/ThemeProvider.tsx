import { type ReactNode, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { type AppTheme, publishTheme, resolveTheme, ThemeOverrideContext } from './index';

/** Renders `children` in `theme` instead of the app theme (component demos, captured themes). */
export function ThemeScope({ theme, children }: { theme: AppTheme | null; children: ReactNode }) {
  return <ThemeOverrideContext.Provider value={theme}>{children}</ThemeOverrideContext.Provider>;
}

/** Applies the signed-in user's Light / Dark / System choice, or their mood. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { user } = useAuth();
  const theme = useMemo(
    () =>
      resolveTheme(
        user?.preferences.theme ?? 'system',
        user?.preferences.mood ?? null,
        system,
      ),
    [user?.preferences.theme, user?.preferences.mood, system],
  );
  publishTheme(theme);
  return children;
}
