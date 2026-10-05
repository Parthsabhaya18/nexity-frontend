import type { MediaKind, MediaPurpose } from '@/features/media/mediaRules';

import { apiClient } from './client';

export interface MediaAsset {
  id: string;
  purpose: MediaPurpose;
  kind: MediaKind;
  status: 'pending' | 'ready';
  /** Null until the upload is completed. */
  url: string | null;
  content_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: string;
}

export type UploadTarget =
  /** S3 presigned POST: send `fields` first, then the file as `file`. */
  | {
      method: 'post';
      url: string;
      fields: Record<string, string>;
      expires_at: string;
    }
  /** Large files: PUT each `part_size` slice to a URL from `partUrls`. */
  | {
      method: 'multipart';
      part_size: number;
      part_count: number;
      expires_at: string;
    }
  /** Same `client_upload_id` as an upload that already finished: nothing to send. */
  | { method: 'complete' };

export interface UploadTicket {
  media: MediaAsset;
  upload: UploadTarget;
  /** True when `client_upload_id` matched an earlier upload of the same file. */
  resumed?: boolean;
}

export interface PartUrls {
  parts: { part_number: number; url: string }[];
  expires_at: string;
}

export interface UploadedParts {
  part_size: number;
  part_count: number;
  parts: { part_number: number; bytes: number }[];
}

export interface CreateUploadInput {
  purpose: MediaPurpose;
  content_type: string;
  bytes: number;
  width?: number;
  height?: number;
  duration_ms?: number;
  /**
   * Stable id chosen by the device for one file. Sending it again returns the
   * same media (a fresh POST, the same multipart upload, or `complete`).
   */
  client_upload_id?: string;
}

export const mediaApi = {
  async createUpload(input: CreateUploadInput, signal?: AbortSignal) {
    const { data } = await apiClient.post<UploadTicket>(
      '/media/uploads',
      input,
      { signal },
    );
    return data;
  },

  /** Up to 100 part numbers per call; URLs expire after ~15 minutes. */
  async partUrls(id: string, partNumbers: number[], signal?: AbortSignal) {
    const { data } = await apiClient.post<PartUrls>(
      `/media/${id}/parts`,
      { part_numbers: partNumbers },
      { signal },
    );
    return data;
  },

  /** Parts S3 already has, for resuming an interrupted upload. */
  async listParts(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<UploadedParts>(`/media/${id}/parts`, {
      signal,
    });
    return data;
  },

  async complete(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.post<MediaAsset>(
      `/media/${id}/complete`,
      undefined,
      { signal },
    );
    return data;
  },

  async get(id: string) {
    const { data } = await apiClient.get<MediaAsset>(`/media/${id}`);
    return data;
  },

  async remove(id: string) {
    await apiClient.delete(`/media/${id}`);
  },
};
