import { apiClient } from './client';

export type Gender =
  | 'woman'
  | 'man'
  | 'other'
  | 'non_binary'
  | 'prefer_not_to_say';

export interface Me {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  /** Full URL including the scheme, or `''`. */
  website: string;
  gender: Gender;
  date_of_birth: string;
  is_private: boolean;
  is_verified: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
  /** Pending requests to this (private) account. */
  follow_requests_count: number;
  role: 'user' | 'moderator' | 'admin';
  onboarding_completed: boolean;
  preferences: {
    theme: 'system' | 'light' | 'dark';
    /** Replaces Light / Dark / System while set. */
    mood:
      | 'happy'
      | 'calm'
      | 'romantic'
      | 'sad'
      | 'angry'
      | 'cool'
      | 'relaxed'
      | 'excited'
      | 'tired'
      | 'motivated'
      | null;
  };
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: Me;
}

/** Codes come back as `dev_code` only from a development backend without SMTP. */
export interface CodeSent {
  resend_available_in: number;
  dev_code?: string;
}

export interface RegisterInput {
  display_name: string;
  username: string;
  email: string;
  password: string;
  gender: Gender;
  date_of_birth: string;
  accept_terms: true;
}

export const authApi = {
  async login(identifier: string, password: string) {
    const { data } = await apiClient.post<Session>('/auth/login', {
      identifier,
      password,
    });
    return data;
  },

  async register(input: RegisterInput) {
    const { data } = await apiClient.post<
      { user: Pick<Me, 'id' | 'username' | 'email' | 'is_verified'> } & CodeSent
    >('/auth/register', input);
    return data;
  },

  async verifyEmail(email: string, code: string) {
    const { data } = await apiClient.post<Session & { verified: true }>(
      '/auth/verify-email',
      { email, code },
    );
    return data;
  },

  async resendVerification(email: string) {
    const { data } = await apiClient.post<CodeSent>(
      '/auth/resend-verification',
      { email },
    );
    return data;
  },

  async forgotPassword(email: string) {
    const { data } = await apiClient.post<CodeSent>('/auth/forgot-password', {
      email,
    });
    return data;
  },

  async verifyResetCode(email: string, code: string) {
    const { data } = await apiClient.post<{
      reset_token: string;
      expires_in: number;
    }>('/auth/verify-reset-code', {
      email,
      code,
    });
    return data;
  },

  async resetPassword(resetToken: string, password: string) {
    await apiClient.post('/auth/reset-password', {
      reset_token: resetToken,
      password,
    });
  },

  async logout(refreshToken: string) {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken });
  },

  async usernameAvailable(username: string) {
    const { data } = await apiClient.get<{
      available: boolean;
      reason?: 'invalid' | 'taken';
    }>('/auth/username-available', { params: { username } });
    return data;
  },

  async me() {
    const { data } = await apiClient.get<Me>('/users/me');
    return data;
  },
};
