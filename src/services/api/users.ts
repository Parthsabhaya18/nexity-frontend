import type { Me, MessagePrivacy, NotificationSettings, TokenPair } from './auth';
import { apiClient } from './client';

/** Only the fields that are sent change; `avatar_media_id: null` removes the photo. */
export interface ProfileUpdate {
  display_name?: string;
  username?: string;
  bio?: string;
  website?: string;
  avatar_media_id?: string | null;
  is_private?: boolean;
  show_activity_status?: boolean;
  message_privacy?: MessagePrivacy;
}

export interface DeviceSession {
  id: string;
  device: string;
  platform: string | null;
  app_version: string | null;
  last_active_at: string;
  current: boolean;
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

  async updateNotificationSettings(body: Partial<NotificationSettings>) {
    const { data } = await apiClient.patch<NotificationSettings>(
      '/users/me/notification-settings',
      body,
    );
    return data;
  },

  /** Signs out every other device; returns a new session for this one. */
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await apiClient.post<TokenPair>('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data;
  },

  async sessions() {
    const { data } = await apiClient.get<{ items: DeviceSession[] }>(
      '/users/me/sessions',
    );
    return data.items;
  },

  async logoutSession(sessionId: string) {
    await apiClient.delete(`/users/me/sessions/${sessionId}`);
  },

  async logoutOtherSessions() {
    await apiClient.delete('/users/me/sessions');
  },

  async deleteAccount(password: string) {
    await apiClient.delete('/users/me', { data: { password } });
  },
};
