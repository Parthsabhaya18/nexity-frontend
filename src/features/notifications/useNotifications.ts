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
};

type NotificationsState = {
  items: readonly AppNotification[];
  unreadCount: number;
};

const EMPTY: NotificationsState = { items: [], unreadCount: 0 };
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
    unreadCount: unread.notifications,
    items: page.items.map(item => ({
      id: item.id,
      type: 'comment',
      text: item.text,
      createdAt: new Date(item.created_at).getTime(),
      read: item.read,
      postId: item.post_id,
      reelId: item.reel_id,
      actor: item.actor,
    })),
  });
}

export async function markNotificationsRead() {
  await notificationsApi.readAll();
  emit({
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
    refreshNotifications().catch(() => {});
  }, []);
  return snap;
}
