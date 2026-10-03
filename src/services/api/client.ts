import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { tokenStore } from '@/features/auth/tokenStore';

const baseHeaders = {
  'Content-Type': 'application/json',
  'X-Platform': Platform.OS,
  'X-App-Version': env.appVersion,
};

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: baseHeaders,
});

export interface FieldError {
  path: string;
  message: string;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: string = 'UNKNOWN',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  /** Field-level messages from `VALIDATION_ERROR` or `{ field }` conflict details. */
  get fieldErrors(): FieldError[] {
    if (Array.isArray(this.details)) {
      return (this.details as FieldError[]).filter(
        d => d && typeof d.path === 'string',
      );
    }
    const field = (this.details as { field?: string } | undefined)?.field;
    return field ? [{ path: field, message: this.message }] : [];
  }
}

function toApiError(error: AxiosError<ErrorBody>): ApiError {
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? new ApiError(
          'The request timed out. Please try again.',
          undefined,
          'TIMEOUT',
        )
      : new ApiError(
          'No internet connection. Check your network and try again.',
          undefined,
          'NETWORK_ERROR',
        );
  }
  const body = error.response.data;
  return new ApiError(
    body?.error?.message ??
      body?.message ??
      'Something went wrong. Please try again.',
    error.response.status,
    body?.error?.code ?? 'UNKNOWN',
    body?.error?.details,
  );
}

apiClient.interceptors.request.use(config => {
  const token = tokenStore.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshing: Promise<string> | null = null;

/** One refresh at a time; concurrent 401s wait for the same rotation. */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken)
      throw new ApiError('Session expired', 401, 'INVALID_REFRESH_TOKEN');
    try {
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(
        `${env.apiBaseUrl}/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: env.apiTimeoutMs, headers: baseHeaders },
      );
      await tokenStore.setTokens(data);
      return data.access_token;
    } catch (err) {
      const apiErr = axios.isAxiosError(err)
        ? toApiError(err as AxiosError<ErrorBody>)
        : (err as ApiError);
      if (apiErr.status === 401) {
        await tokenStore.clear();
        tokenStore.notifySessionExpired();
      }
      throw apiErr;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError<ErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.startsWith('/auth/');
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !isAuthCall &&
      tokenStore.getRefreshToken()
    ) {
      config._retried = true;
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return apiClient(config);
    }
    return Promise.reject(toApiError(error));
  },
);
