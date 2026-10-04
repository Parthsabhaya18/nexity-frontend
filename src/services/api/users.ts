import type { Me } from './auth';
import { apiClient } from './client';

/** Only the fields that are sent change; `avatar_media_id: null` removes the photo. */
export interface ProfileUpdate {
  display_name?: string;
  username?: string;
  bio?: string;
  website?: string;
  avatar_media_id?: string | null;
  is_private?: boolean;
}

export const usersApi = {
  async updateMe(update: ProfileUpdate) {
    const { data } = await apiClient.patch<Me>('/users/me', update);
    return data;
  },

  async updatePreferences(body: {
    theme?: Me['preferences']['theme'];
    mood?: Me['preferences']['mood'];
  }) {
    const { data } = await apiClient.patch<
      Me['preferences'] & { updated_at: string }
    >('/users/me/preferences', body);
    return data;
  },
};
