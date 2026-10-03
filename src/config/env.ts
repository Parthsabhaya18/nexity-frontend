/**
 * Runtime configuration.
 *
 * Development builds talk to the backend running on your PC. The phone reaches it
 * through `adb reverse tcp:4000 tcp:4000` (run `npm run reverse`), so `localhost`
 * on the device maps to `localhost` on the PC over the USB cable.
 */
const DEV_API_URL = 'http://localhost:4000/api/v1';
const PROD_API_URL = 'https://api.nexity.com/api/v1';

export const env = {
  isDev: __DEV__,
  apiBaseUrl: __DEV__ ? DEV_API_URL : PROD_API_URL,
  apiTimeoutMs: 15000,
  appVersion: '1.0.0',
} as const;
