import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StatusBar } from 'react-native';

import { useAppTheme } from '@/theme';

/**
 * Sets the status bar style while the screen is focused. Tab screens stay
 * mounted, so a declarative <StatusBar> would let a hidden tab win.
 */
export function useStatusBar(force?: 'light' | 'dark') {
  const { scheme } = useAppTheme();
  const tone = force ?? scheme;
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(
        tone === 'dark' ? 'light-content' : 'dark-content',
        true,
      );
    }, [tone]),
  );
}
