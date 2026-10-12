import { API_BASE_URL } from '@env';
import { io, type Socket } from 'socket.io-client';

import { tokenStore } from '@/features/auth/tokenStore';

export const CHAT_SOCKET_PATH = '/ws/v1/chat';

/** The socket lives on the API host, outside the `/api/v1` prefix. */
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

export type SocketErrorData = { code?: string };

/**
 * Socket.IO client for chat. The access token is read on every (re)connect,
 * so a refreshed token is picked up automatically.
 */
export function createChatSocket(): Socket {
  return io(SOCKET_ORIGIN, {
    path: CHAT_SOCKET_PATH,
    // React Native has native WebSocket; long-polling adds latency and battery cost.
    transports: ['websocket'],
    autoConnect: false,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 15_000,
    auth: cb => cb({ token: tokenStore.getAccessToken() }),
  });
}
