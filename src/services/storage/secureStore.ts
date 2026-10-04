import * as Keychain from 'react-native-keychain';

const REFRESH_SERVICE = 'com.nexity.app.refresh';
const USER_SERVICE = 'com.nexity.app.user';
const PREF_SERVICE = 'com.nexity.app.pref';

const options = {
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

async function read(service: string) {
  try {
    const entry = await Keychain.getGenericPassword({ service });
    return entry ? entry.password : null;
  } catch {
    return null;
  }
}

export const secureStore = {
  getRefreshToken: () => read(REFRESH_SERVICE),

  async setRefreshToken(token: string) {
    await Keychain.setGenericPassword('refresh', token, {
      ...options,
      service: REFRESH_SERVICE,
    });
  },

  async getUser<T>(): Promise<T | null> {
    const raw = await read(USER_SERVICE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setUser(user: unknown) {
    await Keychain.setGenericPassword('user', JSON.stringify(user), {
      ...options,
      service: USER_SERVICE,
    });
  },

  /** Small device preferences (e.g. quick reactions). Kept across sign-outs. */
  async getPreference<T>(name: string): Promise<T | null> {
    const raw = await read(`${PREF_SERVICE}.${name}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setPreference(name: string, value: unknown) {
    try {
      await Keychain.setGenericPassword(name, JSON.stringify(value), {
        ...options,
        service: `${PREF_SERVICE}.${name}`,
      });
    } catch {
      // Preferences are best-effort; the in-memory value still applies.
    }
  },

  async clear() {
    await Promise.all([
      Keychain.resetGenericPassword({ service: REFRESH_SERVICE }),
      Keychain.resetGenericPassword({ service: USER_SERVICE }),
    ]);
  },
};
