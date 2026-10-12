import { apiClient } from './client';

/** Mirror of `SUPPORT_SUBJECTS` in the backend support module. */
export const SUPPORT_SUBJECTS = [
  'Account',
  'Privacy & safety',
  'Posts, reels & stories',
  'Messages',
  'Report a bug',
  'Other',
] as const;

export type SupportSubject = (typeof SUPPORT_SUBJECTS)[number];

export interface SupportTicket {
  id: string;
  /** Short code to quote to support, e.g. `NX-3F9A2C`. */
  reference: string;
  subject: SupportSubject;
  message: string;
  status: 'pending' | 'resolved';
  screenshot_urls: string[];
  created_at: string;
  updated_at: string;
}

export const supportApi = {
  async tickets() {
    const { data } = await apiClient.get<{ items: SupportTicket[] }>(
      '/support/tickets',
    );
    return data.items;
  },

  async ticket(id: string) {
    const { data } = await apiClient.get<SupportTicket>(
      `/support/tickets/${id}`,
    );
    return data;
  },

  async create(input: {
    subject: SupportSubject;
    message: string;
    screenshot_media_ids: string[];
  }) {
    const { data } = await apiClient.post<SupportTicket>(
      '/support/tickets',
      input,
    );
    return data;
  },
};
