import { useEffect, useSyncExternalStore } from 'react';

import { notificationsApi } from '@/services/api/notifications';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'chat'
  | 'secret'
  | 'crush'
  | 'match'
  | 'subscription';

export type NotificationActor = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  text: string;
  createdAt: number;
  read: boolean;
  actor: NotificationActor | null;
  postId: string | null;
  reelId: string | null;
  secretThreadId: string | null;
  crushMatchId: string | null;
  conversationId: string | null;
  nearby: boolean;
};

const typeOf = (t: string): NotificationType =>
  t === 'crush_added'
    ? 'crush'
    : t === 'crush_match'
    ? 'match'
    : t.startsWith('secret_') || t === 'nearby_encounter'
    ? 'secret'
    : t.startsWith('subscription_') || t.startsWith('payment_')
    ? 'subscription'
    : 'comment';

type NotificationsState = {
  items: readonly AppNotification[];
  unreadCount: number;
  /** The first fetch has finished, whether or not it worked. */
  loaded: boolean;
};

const EMPTY: NotificationsState = { items: [], unreadCount: 0, loaded: false };
let state: NotificationsState = EMPTY;
const listeners = new Set<() => void>();

function emit(next: NotificationsState) {
  state = next;
  listeners.forEach(listener => listener());
}

export async function refreshNotifications() {
  const [page, unread] = await Promise.all([
    notificationsApi.list(),
    notificationsApi.unread(),
  ]);
  emit({
    loaded: true,
    unreadCount: unread.notifications,
    items: page.items.map(item => ({
      id: item.id,
      type: typeOf(item.type),
      text: item.text,
      createdAt: new Date(item.created_at).getTime(),
      read: item.read,
      postId: item.post_id,
      reelId: item.reel_id,
      secretThreadId: item.secret_thread_id ?? null,
      crushMatchId: item.crush_match_id ?? null,
      conversationId: item.conversation_id ?? null,
      nearby: item.type === 'nearby_encounter',
      actor: item.anonymous ? null : item.actor,
    })),
  });
}

export async function markNotificationsRead() {
  await notificationsApi.readAll();
  emit({
    ...state,
    unreadCount: 0,
    items: state.items.map(item => ({ ...item, read: true })),
  });
}

export function useNotifications(): NotificationsState {
  const snap = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  useEffect(() => {
    refreshNotifications().catch(() => {
      if (!state.loaded) emit({ ...state, loaded: true });
    });
  }, []);
  return snap;
}
