import { useEffect } from 'react';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { ChatProvider } from '@/features/chats/ChatProvider';
import { sweepUploadCache } from '@/features/media/localFiles';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function App() {
  useEffect(() => {
    const timer = setTimeout(() => {
      sweepUploadCache().catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <ThemeProvider>
          <ChatProvider>
            <RootNavigator />
          </ChatProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
