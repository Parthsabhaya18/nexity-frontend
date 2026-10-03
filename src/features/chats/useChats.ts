export type ChatPeer = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

export type ChatKind = 'normal' | 'match' | 'revealed';

export type ChatSummary = {
  id: string;
  kind: ChatKind;
  peer: ChatPeer;
  /** Preview of the last message, already prefixed with "You: " when sent by me. */
  lastMessage: string | null;
  /** Epoch milliseconds of the last message. */
  lastMessageAt: number | null;
  unread: number;
};

type ChatsState = {
  chats: readonly ChatSummary[];
  unreadCount: number;
};

const EMPTY: ChatsState = { chats: [], unreadCount: 0 };

/** Inbox for the signed-in user. Backed by the API once the chat service ships. */
export function useChats(): ChatsState {
  return EMPTY;
}
