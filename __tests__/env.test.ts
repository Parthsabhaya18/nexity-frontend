import { env } from '@/config/env';

test('uses the USB-reversed localhost API in development', () => {
  expect(env.isDev).toBe(true);
  expect(env.apiBaseUrl).toBe('http://localhost:4000/api/v1');
});
