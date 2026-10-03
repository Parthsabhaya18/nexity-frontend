import axios, { AxiosError } from 'axios';

import { env } from '@/config/env';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ??
      (error.code === 'ECONNABORTED'
        ? 'Request timed out'
        : error.message || 'Network error');
    return Promise.reject(new ApiError(message, status));
  },
);
