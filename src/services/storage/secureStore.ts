import * as Keychain from 'react-native-keychain';

const REFRESH_SERVICE = 'com.nexity.app.refresh';
const USER_SERVICE = 'com.nexity.app.user';

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

  async clear() {
    await Promise.all([
      Keychain.resetGenericPassword({ service: REFRESH_SERVICE }),
      Keychain.resetGenericPassword({ service: USER_SERVICE }),
    ]);
  },
};
