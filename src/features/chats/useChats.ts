import { useMemo } from 'react';

import type { ConversationDto } from '@/services/api/chat';

import { type ChatState, presenceOf, useChatStore } from './chatStore';

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
  online: boolean;
  lastActiveAt: string | null;
  muted: boolean;
};

type ChatsState = {
  chats: readonly ChatSummary[];
  /** Conversations with unread messages, for the Home header badge. */
  unreadCount: number;
  status: ChatState['inbox']['status'];
  error: string | null;
  hasMore: boolean;
};

const FALLBACK_PEER: ChatPeer = {
  id: 'unknown',
  username: 'nexity.user',
  display_name: 'Nexity user',
  avatar_url: null,
};

type LastMessage = NonNullable<ConversationDto['last_message']>;

export function previewText(last: LastMessage, mine: boolean) {
  if (last.is_deleted)
    return mine ? 'You unsent a message' : 'Unsent a message';
  const text =
    last.type === 'image'
      ? 'Sent a photo'
      : last.type === 'video'
      ? 'Sent a video'
      : last.type === 'album'
      ? 'Sent photos'
      : last.type === 'gif'
      ? 'Sent a GIF'
      : last.type === 'sticker'
      ? 'Sent a sticker'
      : last.type === 'voice'
      ? 'Sent a voice message'
      : last.type === 'share_post'
      ? 'Sent a post'
      : last.type === 'share_reel'
      ? 'Sent a reel'
      : last.type === 'share_profile'
      ? 'Sent a profile'
      : last.body;
  return mine ? `You: ${text}` : text;
}

/** Above this, the inbox shows "5+ new messages". */
export const UNREAD_CAP = 5;

/**
 * Second line of an inbox row, Instagram style: the message itself when one is
 * unread, "3 new messages" / "5+ new messages" for more, otherwise the preview.
 */
export function inboxSubtitle(
  chat: Pick<ChatSummary, 'unread' | 'lastMessage' | 'online'>,
): { text: string; showTime: boolean } {
  if (chat.unread > UNREAD_CAP)
    return { text: `${UNREAD_CAP}+ new messages`, showTime: true };
  if (chat.unread > 1)
    return { text: `${chat.unread} new messages`, showTime: true };
  if (chat.unread === 1 || !chat.online)
    return {
      text: chat.lastMessage ?? 'Say hi 👋',
      showTime: Boolean(chat.lastMessage),
    };
  return { text: 'Active now', showTime: false };
}

/** Inbox for the signed-in user, kept live by the chat socket. */
export function useChats(): ChatsState {
  const conversations = useChatStore(s => s.conversations);
  const presence = useChatStore(s => s.presence);
  const meId = useChatStore(s => s.meId);
  const inbox = useChatStore(s => s.inbox);

  return useMemo(() => {
    const chats = Object.values(conversations)
      .filter(c => c.last_message)
      .map<ChatSummary>(c => {
        const last = c.last_message!;
        const live = presenceOf(c.peer, presence);
        return {
          id: c.id,
          kind:
            c.origin === 'secret_crush_match'
              ? 'match'
              : c.origin === 'secret_message'
              ? 'revealed'
              : 'normal',
          peer: c.peer ?? FALLBACK_PEER,
          lastMessage: previewText(last, last.sender_id === meId),
          lastMessageAt: Date.parse(last.created_at),
          unread: c.unread_count,
          online: live.online,
          lastActiveAt: live.lastActiveAt,
          muted: c.is_muted,
        };
      })
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

    return {
      chats,
      unreadCount: chats.filter(c => c.unread > 0 && !c.muted).length,
      status: inbox.status,
      error: inbox.error,
      hasMore: inbox.hasMore,
    };
  }, [conversations, presence, meId, inbox]);
}
