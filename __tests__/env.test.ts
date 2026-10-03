import { API_BASE_URL, API_TIMEOUT_MS, APP_VERSION } from '@env';

test('loads config from .env', () => {
  expect(API_BASE_URL).toMatch(/^https?:\/\//);
  expect(Number(API_TIMEOUT_MS)).toBeGreaterThan(0);
  expect(APP_VERSION).toBeTruthy();
});
