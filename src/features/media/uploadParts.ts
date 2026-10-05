import ReactNativeBlobUtil from 'react-native-blob-util';

import { ApiError } from '@/services/api/client';
import { mediaApi } from '@/services/api/media';

import { deleteFile, sliceToTemp } from './localFiles';

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

export const isUploadCancelled = (err: unknown) =>
  err instanceof UploadCancelledError;

/** Network drops, timeouts and server hiccups: worth trying again later. */
export const isRetryable = (err: unknown) =>
  err instanceof ApiError &&
  (err.isNetworkError || err.status === 429 || (err.status ?? 0) >= 500);

const PARALLEL_PARTS = 3;
const URL_BATCH = 20;
/** Waits between attempts of one part: ~1 minute in total before giving up. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000];
/** Refresh a part URL this long before it expires. */
const URL_MARGIN_MS = 60 * 1000;

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new UploadCancelledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort);
  });
}

/** Single API calls and POST uploads: ~15 s of retries before the error reaches the user. */
const CALL_BACKOFF_MS = [1000, 2000, 4000, 8000];

/** Runs `task` again with exponential backoff while it fails with a retryable error. */
export async function withRetry<T>(
  task: () => Promise<T>,
  signal?: AbortSignal,
  backoff: readonly number[] = CALL_BACKOFF_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (signal?.aborted || isUploadCancelled(err)) {
        throw new UploadCancelledError();
      }
      if (!isRetryable(err) || attempt >= backoff.length) throw err;
      await sleep(backoff[attempt], signal);
    }
  }
}

class PartHttpError extends Error {
  constructor(public readonly status: number, body: string) {
    super(/<Code>([^<]+)<\/Code>/.exec(body)?.[1] ?? `HTTP ${status}`);
  }
}

/** Streams one part file natively with its exact Content-Length (part URLs sign it). */
async function putPart(
  url: string,
  path: string,
  onSent: (bytes: number) => void,
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw new UploadCancelledError();
  const task = ReactNativeBlobUtil.fetch(
    'PUT',
    url,
    { 'Content-Type': 'application/octet-stream' },
    ReactNativeBlobUtil.wrap(path),
  );
  task.uploadProgress({ interval: 250 }, sent => onSent(Number(sent)));
  const onAbort = () => {
    task.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await task;
    const status = res.info().status;
    if (status < 200 || status >= 300) {
      throw new PartHttpError(status, String(res.data ?? ''));
    }
  } catch (err) {
    if (signal?.aborted) throw new UploadCancelledError();
    if (err instanceof PartHttpError) throw err;
    throw new ApiError(
      'Upload failed. Check your connection and try again.',
      undefined,
      'NETWORK_ERROR',
    );
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Uploads a large file to an S3 multipart upload, three parts at a time.
 * With `resume`, parts S3 already has are skipped, so a retry after a dropped
 * connection only sends what is missing. Each part is retried with backoff.
 */
export async function uploadParts(opts: {
  mediaId: string;
  uri: string;
  bytes: number;
  partSize: number;
  partCount: number;
  resume?: boolean;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}) {
  const { mediaId, uri, bytes, partSize, partCount, signal } = opts;
  const done = new Set<number>();
  let doneBytes = 0;
  const lengthOf = (n: number) =>
    n < partCount ? partSize : bytes - (n - 1) * partSize;

  if (opts.resume) {
    const uploaded = await mediaApi.listParts(mediaId, signal);
    for (const p of uploaded.parts) {
      done.add(p.part_number);
      doneBytes += p.bytes;
    }
  }

  const inFlight = new Map<number, number>();
  const report = () => {
    let sent = doneBytes;
    inFlight.forEach(b => (sent += b));
    opts.onProgress?.(Math.min(1, sent / bytes));
  };
  report();

  const queue: number[] = [];
  for (let n = 1; n <= partCount; n++) if (!done.has(n)) queue.push(n);

  const urls = new Map<number, { url: string; expiresAt: number }>();
  let fetching: Promise<void> | undefined;

  async function urlFor(n: number) {
    const cached = urls.get(n);
    if (cached && cached.expiresAt - URL_MARGIN_MS > Date.now()) {
      return cached.url;
    }
    // One request at a time, for this part plus the next ones in the queue.
    while (fetching) await fetching;
    const fresh = urls.get(n);
    if (fresh && fresh.expiresAt - URL_MARGIN_MS > Date.now()) return fresh.url;
    const wanted = [n, ...queue.filter(q => q !== n)].slice(0, URL_BATCH);
    fetching = mediaApi.partUrls(mediaId, wanted, signal).then(res => {
      const expiresAt = Date.parse(res.expires_at);
      for (const p of res.parts) {
        urls.set(p.part_number, { url: p.url, expiresAt });
      }
    });
    try {
      await fetching;
    } finally {
      fetching = undefined;
    }
    return urls.get(n)!.url;
  }

  async function sendPart(n: number) {
    const start = (n - 1) * partSize;
    const length = lengthOf(n);
    for (let attempt = 0; ; attempt++) {
      let chunk: string | undefined;
      try {
        const url = await urlFor(n);
        chunk = await sliceToTemp(
          uri,
          start,
          start + length,
          `${mediaId}-${n}.part`,
        );
        await putPart(
          url,
          chunk,
          sent => {
            inFlight.set(n, Math.min(sent, length));
            report();
          },
          signal,
        );
        inFlight.delete(n);
        done.add(n);
        doneBytes += length;
        report();
        return;
      } catch (err) {
        inFlight.delete(n);
        report();
        if (isUploadCancelled(err) || signal?.aborted) {
          throw new UploadCancelledError();
        }
        if (err instanceof PartHttpError) {
          // 403: URL expired (e.g. the phone slept); 404: S3 dropped the upload.
          if (err.status === 404) {
            throw new ApiError(
              'The upload expired. Please try again.',
              404,
              'UPLOAD_EXPIRED',
            );
          }
          urls.delete(n);
          if (err.status < 500 && err.status !== 403) throw err;
        } else if (!isRetryable(err)) {
          throw err;
        }
        if (attempt >= BACKOFF_MS.length) {
          throw err instanceof PartHttpError
            ? new ApiError(
                "Couldn't upload the file. Please try again.",
                err.status,
                'UPLOAD_FAILED',
              )
            : err;
        }
        await sleep(BACKOFF_MS[attempt], signal);
      } finally {
        await deleteFile(chunk);
      }
    }
  }

  let failure: unknown;
  const worker = async () => {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      if (failure) return;
      try {
        await sendPart(n);
      } catch (err) {
        failure ??= err;
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL_PARTS, queue.length) }, worker),
  );
  if (failure) throw failure;
  opts.onProgress?.(1);
}
