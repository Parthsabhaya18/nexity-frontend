import { secureStore } from '@/services/storage/secureStore';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

/** Holds tokens in memory; the refresh token is mirrored to the Keychain / Keystore. */
export const tokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

  async setTokens(tokens: { access_token: string; refresh_token: string }) {
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    await secureStore.setRefreshToken(tokens.refresh_token);
  },

  /** Restores a refresh token read from secure storage at launch. */
  restore(storedRefreshToken: string) {
    accessToken = null;
    refreshToken = storedRefreshToken;
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    await secureStore.clear();
  },

  setOnSessionExpired(listener: (() => void) | null) {
    onSessionExpired = listener;
  },

  notifySessionExpired() {
    onSessionExpired?.();
  },
};
