import { type ReactNode, useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

import { chat } from './chatController';

/** Keeps the chat socket and inbox alive for as long as someone is signed in. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = status === 'signedIn' ? user?.id : undefined;

  useEffect(() => {
    if (!userId) return;
    chat.start(userId);
    return () => chat.stop();
  }, [userId]);

  return children;
}
