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
  /** Epoch milliseconds. */
  createdAt: number;
  read: boolean;
  /** Null for anonymous categories (secret messages, crushes). */
  actor: NotificationActor | null;
};

type NotificationsState = {
  items: readonly AppNotification[];
  unreadCount: number;
};

const EMPTY: NotificationsState = { items: [], unreadCount: 0 };

/** Notifications for the signed-in user. Backed by the API once the notifications service ships. */
export function useNotifications(): NotificationsState {
  return EMPTY;
}
