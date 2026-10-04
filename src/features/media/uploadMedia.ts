import { ApiError } from '@/services/api/client';
import { type MediaAsset, mediaApi } from '@/services/api/media';

import { deleteFile, fileExists, fileSize } from './localFiles';
import { formatBytes, MEDIA_RULES, type MediaPurpose } from './mediaRules';
import { type LocalMedia, MediaError } from './pickMedia';
import { prepareMedia } from './prepareMedia';
import {
  isRetryable,
  isUploadCancelled,
  UploadCancelledError,
  uploadParts,
} from './uploadParts';

export { isUploadCancelled, UploadCancelledError };

/** Progress bar split: compression, then S3 transfer, then verification. */
const PREPARE_SHARE = { image: 0.05, video: 0.4 } as const;
const VERIFY_SHARE = 0.05;

export type UploadPhase = 'processing' | 'uploading';

/**
 * State kept between attempts of one file, so a retry neither re-compresses
 * nor re-sends parts S3 already has. Pass the same object to every attempt and
 * call `discardUploadSession` when the file is abandoned.
 */
export interface UploadSession {
  /** Compressed copy made for this upload (may be the original). */
  prepared?: LocalMedia;
  /** Unfinished multipart upload that can be resumed. */
  resumable?: { mediaId: string; partSize: number; partCount: number };
}

function s3Error(status: number, body: string, maxBytes: number) {
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  if (code === 'EntityTooLarge') {
    return new MediaError(
      `This file is too large. The limit is ${formatBytes(maxBytes)}.`,
    );
  }
  if (code === 'AccessDenied' && /expired/i.test(body)) {
    return new ApiError(
      'The upload took too long. Please try again.',
      status,
      'UPLOAD_EXPIRED',
    );
  }
  return new ApiError(
    "Couldn't upload the file. Please try again.",
    status,
    code ?? 'UPLOAD_FAILED',
  );
}

/**
 * Streams the file from its `file://` / `content://` URI straight to S3. XHR is
 * used instead of axios for reliable multipart bodies and upload progress on RN.
 */
function postToS3(
  url: string,
  form: FormData,
  maxBytes: number,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const done = () => signal?.removeEventListener('abort', onAbort);

    xhr.open('POST', url);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(s3Error(xhr.status, xhr.responseText ?? '', maxBytes));
    };
    xhr.onerror = () => {
      done();
      reject(
        new ApiError(
          'Upload failed. Check your connection and try again.',
          undefined,
          'NETWORK_ERROR',
        ),
      );
    };
    xhr.onabort = () => {
      done();
      reject(new UploadCancelledError());
    };
    signal?.addEventListener('abort', onAbort);
    xhr.send(form);
  });
}

const isTempCopy = (session: UploadSession, original: LocalMedia) =>
  !!session.prepared && session.prepared.uri !== original.uri;

/** Releases the server reservation and deletes the compressed copy. */
export async function discardUploadSession(
  session: UploadSession,
  original: LocalMedia,
) {
  const mediaId = session.resumable?.mediaId;
  session.resumable = undefined;
  if (mediaId) mediaApi.remove(mediaId).catch(() => {});
  if (isTempCopy(session, original)) await deleteFile(session.prepared!.uri);
  session.prepared = undefined;
}

async function prepareOnce(
  original: LocalMedia,
  purpose: MediaPurpose,
  session: UploadSession,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
) {
  const reusable =
    session.prepared && (await fileExists(session.prepared.uri))
      ? session.prepared
      : undefined;
  const media =
    reusable ?? (await prepareMedia(original, purpose, { signal, onProgress }));
  session.prepared = media;
  onProgress(1);

  // Multipart parts are cut by byte offset, so the size must be exact.
  const bytes = (await fileSize(media.uri)) || media.bytes;
  if (!bytes) {
    throw new MediaError("This file couldn't be read. Try a different one.");
  }
  return { ...media, bytes };
}

/**
 * Uploads one file: compress → reserve → S3 (single POST, or resumable parts
 * for large files) → verify. Resolves with a `ready` asset whose `id` can be
 * attached to a post, story, reel, avatar or message.
 */
export async function uploadMedia(
  original: LocalMedia,
  purpose: MediaPurpose,
  opts: {
    onProgress?: (fraction: number) => void;
    onPhase?: (phase: UploadPhase) => void;
    signal?: AbortSignal;
    session?: UploadSession;
  } = {},
): Promise<MediaAsset> {
  const { signal } = opts;
  const session = opts.session ?? {};
  const onProgress = opts.onProgress ?? (() => {});
  const prepShare = PREPARE_SHARE[original.kind];
  const transferShare = 1 - prepShare - VERIFY_SHARE;
  const onTransfer = (f: number) => onProgress(prepShare + f * transferShare);

  let postMediaId: string | undefined;
  try {
    opts.onPhase?.('processing');
    const media = await prepareOnce(
      original,
      purpose,
      session,
      f => onProgress(f * prepShare),
      signal,
    );
    if (signal?.aborted) throw new UploadCancelledError();
    const maxBytes = MEDIA_RULES[purpose][media.kind]?.maxBytes ?? 0;
    if (media.bytes > maxBytes) {
      throw new MediaError(
        `This file is too large. The limit is ${formatBytes(maxBytes)}.`,
      );
    }

    opts.onPhase?.('uploading');
    const sendParts = (resume: boolean) => {
      const r = session.resumable!;
      return uploadParts({
        mediaId: r.mediaId,
        uri: media.uri,
        bytes: media.bytes,
        partSize: r.partSize,
        partCount: r.partCount,
        resume,
        signal,
        onProgress: onTransfer,
      });
    };

    let resumed = false;
    if (session.resumable) {
      try {
        await sendParts(true);
        resumed = true;
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === 'NOT_MULTIPART_UPLOAD') {
          // Every part was already assembled; only verification is left.
          resumed = true;
        } else if (code === 'UPLOAD_EXPIRED') {
          session.resumable = undefined;
        } else {
          throw err;
        }
      }
    }

    let mediaId: string;
    if (resumed) {
      mediaId = session.resumable!.mediaId;
    } else {
      const ticket = await mediaApi.createUpload(
        {
          purpose,
          content_type: media.contentType,
          bytes: media.bytes,
          width: media.width,
          height: media.height,
          duration_ms: media.kind === 'video' ? media.durationMs : undefined,
        },
        signal,
      );
      mediaId = ticket.media.id;
      const target = ticket.upload;

      if (target.method === 'multipart') {
        session.resumable = {
          mediaId,
          partSize: target.part_size,
          partCount: target.part_count,
        };
        await sendParts(false);
      } else {
        postMediaId = mediaId;
        const form = new FormData();
        for (const [name, value] of Object.entries(target.fields)) {
          form.append(name, value);
        }
        // S3 ignores every field after `file`, so it must be appended last.
        form.append('file', {
          uri: media.uri,
          type: media.contentType,
          name: media.fileName,
        } as unknown as Blob);
        await postToS3(target.url, form, maxBytes, onTransfer, signal);
      }
    }

    let asset: MediaAsset;
    try {
      asset = await mediaApi.complete(mediaId, signal);
    } catch (err) {
      // A part S3 lost or never acknowledged: send what's missing, once.
      if (
        !session.resumable ||
        !(err instanceof ApiError) ||
        err.code !== 'UPLOAD_INCOMPLETE'
      ) {
        throw err;
      }
      await sendParts(true);
      asset = await mediaApi.complete(mediaId, signal);
    }

    session.resumable = undefined;
    postMediaId = undefined;
    if (isTempCopy(session, original)) await deleteFile(session.prepared!.uri);
    session.prepared = undefined;
    onProgress(1);
    return asset;
  } catch (err) {
    if (postMediaId) mediaApi.remove(postMediaId).catch(() => {});
    const cancelled = signal?.aborted || isUploadCancelled(err);
    // Keep a multipart upload only when a retry can pick it up.
    if (session.resumable && (cancelled || !isRetryable(err))) {
      mediaApi.remove(session.resumable.mediaId).catch(() => {});
      session.resumable = undefined;
    }
    if (cancelled) throw new UploadCancelledError();
    throw err;
  }
}

export function uploadErrorMessage(err: unknown) {
  if (err instanceof MediaError || err instanceof ApiError) return err.message;
  return "Couldn't upload the file. Please try again.";
}
