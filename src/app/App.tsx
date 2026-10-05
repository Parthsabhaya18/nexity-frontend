import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { PermissionHost } from '@/components/permissions/PermissionHost';
import { ToastHost } from '@/components/ui/Toast';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ChatProvider } from '@/features/chats/ChatProvider';
import { queryClient } from '@/features/entities/entityCache';
import { sweepUploadJournal } from '@/features/media/uploadJournal';
import { sweepUploadCache } from '@/features/media/localFiles';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function App() {
  useEffect(() => {
    const timer = setTimeout(() => {
      sweepUploadCache().catch(() => {});
      sweepUploadJournal().catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <ChatProvider>
              <RootNavigator />
              <ToastHost />
              <PermissionHost />
            </ChatProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
