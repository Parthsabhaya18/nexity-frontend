import type { ChatUser } from './chat';
import { apiClient } from './client';

export type ShareKind = 'post' | 'reel' | 'profile';

export const shareLink = (kind: ShareKind, id: string) => `https://nexity.com/${kind}s/${id}`;

export const sharesApi = {
  /** People you chat with, follow, or who follow you; `q` narrows by name. */
  async targets(q: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ data: ChatUser[] }>('/shares/targets', {
      params: q ? { q } : {},
      signal,
    });
    return data.data;
  },

  /** Sends the post or reel to each person's chat, with the note as its own message. */
  async send(input: {
    kind: ShareKind;
    id: string;
    user_ids: string[];
    body: string;
    media_index?: number;
  }) {
    const { data } = await apiClient.post<{ conversation_ids: string[] }>('/shares', input);
    return data;
  },
};
