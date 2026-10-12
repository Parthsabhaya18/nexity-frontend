import { useCallback, useEffect, useRef, useState } from 'react';

import type { MediaAsset } from '@/services/api/media';

import type { MediaPurpose } from './mediaRules';
import type { LocalMedia } from './pickMedia';
import { newClientUploadId, pendingUploads } from './uploadJournal';
import {
  discardUploadSession,
  isUploadCancelled,
  uploadErrorMessage,
  uploadMedia,
  type UploadSession,
} from './uploadMedia';

export type UploadStatus =
  | 'queued'
  /** Compressing on the device. */
  | 'processing'
  | 'uploading'
  | 'done'
  | 'error'
  | 'cancelled';

export interface UploadItem {
  key: string;
  /** Sent as `client_upload_id`; survives app restarts through the upload journal. */
  clientUploadId: string;
  media: LocalMedia;
  status: UploadStatus;
  progress: number;
  asset?: MediaAsset;
  error?: string;
}

/** Rejects when any file fails or is cancelled; per-file state stays in `items`. */
export class UploadBatchError extends Error {
  constructor(message: string, public readonly cancelled: boolean) {
    super(message);
    this.name = 'UploadBatchError';
  }
}

let nextKey = 0;

/**
 * Uploads a set of files (e.g. a carousel) with per-file progress, cancel and
 * retry. Results keep the order the files were given in. Retrying resumes
 * large files where they stopped; temp copies are deleted when a file is done,
 * replaced, reset or the screen unmounts.
 */
export function useMediaUpload(
  purpose: MediaPurpose,
  { concurrency = 2 }: { concurrency?: number } = {},
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const sessions = useRef(new Map<string, UploadSession>());
  const mounted = useRef(true);

  const abortAll = useCallback(() => {
    controllers.current.forEach(c => c.abort());
    controllers.current.clear();
    const list = itemsRef.current;
    sessions.current.forEach((session, key) => {
      const item = list.find(i => i.key === key);
      if (item) discardUploadSession(session, item.media).catch(() => {});
    });
    sessions.current.clear();
  }, []);

  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next;
    if (mounted.current) setItems(next);
  }, []);

  const patch = useCallback(
    (key: string, change: Partial<UploadItem>) => {
      commit(
        itemsRef.current.map(i => (i.key === key ? { ...i, ...change } : i)),
      );
    },
    [commit],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortAll();
    };
  }, [abortAll]);

  const runOne = useCallback(
    async (item: UploadItem) => {
      const controller = new AbortController();
      controllers.current.set(item.key, controller);
      let session = sessions.current.get(item.key);
      if (!session) {
        session = { clientUploadId: item.clientUploadId };
        sessions.current.set(item.key, session);
      }
      patch(item.key, { status: 'processing', progress: 0, error: undefined });
      let lastPct = -1;
      try {
        const asset = await uploadMedia(item.media, purpose, {
          session,
          signal: controller.signal,
          onPhase: phase => patch(item.key, { status: phase }),
          onProgress: f => {
            const pct = Math.floor(f * 100);
            if (pct !== lastPct) {
              lastPct = pct;
              patch(item.key, { progress: f });
            }
          },
        });
        sessions.current.delete(item.key);
        patch(item.key, { status: 'done', progress: 1, asset });
      } catch (err) {
        // Cancelled or permanent failures release the old id; the retry gets a new one.
        const clientUploadId = (session.clientUploadId ??= newClientUploadId());
        patch(
          item.key,
          isUploadCancelled(err)
            ? { status: 'cancelled', progress: 0, clientUploadId }
            : {
                status: 'error',
                error: uploadErrorMessage(err),
                clientUploadId,
              },
        );
      } finally {
        controllers.current.delete(item.key);
      }
    },
    [patch, purpose],
  );

  const runPending = useCallback(async (): Promise<MediaAsset[]> => {
    const queue = itemsRef.current.filter(i => i.status === 'queued');
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const key = item.key;
        const current = itemsRef.current.find(i => i.key === key);
        if (current?.status === 'queued') await runOne(current);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, worker),
    );

    const final = itemsRef.current;
    const failed = final.find(i => i.status === 'error');
    if (failed)
      throw new UploadBatchError(failed.error ?? 'Upload failed', false);
    if (final.some(i => i.status === 'cancelled')) {
      throw new UploadBatchError('Upload cancelled', true);
    }
    return final.map(i => i.asset!);
  }, [concurrency, runOne]);

  /** Replaces the current batch and uploads every file. */
  const start = useCallback(
    (medias: LocalMedia[]) => {
      abortAll();
      commit(
        medias.map(media => ({
          key: `upload-${++nextKey}`,
          clientUploadId: newClientUploadId(),
          media,
          status: 'queued' as const,
          progress: 0,
        })),
      );
      return runPending();
    },
    [abortAll, commit, runPending],
  );

  /**
   * Picks up this purpose's uploads that were interrupted by an app restart
   * (from the on-disk journal) and finishes them: compressed copies are reused,
   * multipart uploads skip parts S3 already has, finished files return at once.
   * Resolves with `[]` when nothing was pending.
   */
  const resumePending = useCallback(async (): Promise<MediaAsset[]> => {
    abortAll();
    const pending = await pendingUploads(purpose);
    if (!pending.length) {
      commit([]);
      return [];
    }
    const next = pending.map(entry => {
      const key = `upload-${++nextKey}`;
      sessions.current.set(key, {
        clientUploadId: entry.clientUploadId,
        prepared: entry.prepared,
      });
      return {
        key,
        clientUploadId: entry.clientUploadId,
        media: entry.original,
        status: 'queued' as const,
        progress: 0,
      };
    });
    commit(next);
    return runPending();
  }, [abortAll, commit, purpose, runPending]);

  /** Re-uploads failed or cancelled files (resuming large ones); finished ones are kept. */
  const retryFailed = useCallback(() => {
    commit(
      itemsRef.current.map(i =>
        i.status === 'error' || i.status === 'cancelled'
          ? { ...i, status: 'queued' as const, progress: 0, error: undefined }
          : i,
      ),
    );
    return runPending();
  }, [commit, runPending]);

  const cancel = useCallback(() => {
    controllers.current.forEach(c => c.abort());
    commit(
      itemsRef.current.map(i =>
        i.status === 'queued' ? { ...i, status: 'cancelled' as const } : i,
      ),
    );
  }, [commit]);

  const reset = useCallback(() => {
    abortAll();
    commit([]);
  }, [abortAll, commit]);

  const progress = items.length
    ? items.reduce((sum, i) => sum + i.progress, 0) / items.length
    : 0;

  return {
    items,
    progress,
    isUploading: items.some(
      i =>
        i.status === 'queued' ||
        i.status === 'processing' ||
        i.status === 'uploading',
    ),
    hasFailed: items.some(i => i.status === 'error'),
    start,
    resumePending,
    retryFailed,
    cancel,
    reset,
  };
}
