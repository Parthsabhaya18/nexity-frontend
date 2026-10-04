import {
  getFileSize,
  getImageMetaData,
  getVideoMetaData,
  Image as ImageCompressor,
  Video as VideoCompressor,
} from 'react-native-compressor';

import { deleteFile } from './localFiles';
import {
  formatBytes,
  IMAGE_MAX_EDGE,
  MEDIA_RULES,
  type MediaPurpose,
  VIDEO_COMPRESS_FROM_MB,
  VIDEO_MAX_EDGE,
} from './mediaRules';
import {
  isTooLong,
  type LocalMedia,
  MediaError,
  tooLongMessage,
} from './pickMedia';

const IMAGE_QUALITY = 0.8;

const withExt = (name: string, ext: string) =>
  `${name.replace(/\.[^./]+$/, '') || 'upload'}.${ext}`;

async function sizeOf(uri: string, fallback: number) {
  const size = Number(await getFileSize(uri).catch(() => NaN));
  return Number.isFinite(size) && size > 0 ? size : fallback;
}

/** Any photo becomes a JPEG no larger than the purpose's long edge. */
async function prepareImage(
  media: LocalMedia,
  purpose: MediaPurpose,
): Promise<LocalMedia> {
  const edge = IMAGE_MAX_EDGE[purpose];
  const uri = await ImageCompressor.compress(media.uri, {
    compressionMethod: 'manual',
    maxWidth: edge,
    maxHeight: edge,
    quality: IMAGE_QUALITY,
    output: 'jpg',
    disablePngTransparency: true,
  });

  let width = media.width;
  let height = media.height;
  const meta = await getImageMetaData(uri).catch(() => null);
  if (meta?.ImageWidth && meta.ImageHeight) {
    width = meta.ImageWidth;
    height = meta.ImageHeight;
  } else if (width && height) {
    const scale = Math.min(1, edge / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  return {
    ...media,
    uri,
    contentType: 'image/jpeg',
    fileName: withExt(media.fileName, 'jpg'),
    bytes: await sizeOf(uri, meta?.size ?? 0),
    width,
    height,
  };
}

/** Re-encodes to a 1080p MP4 like Instagram (720p for chats); length is kept. */
async function prepareVideo(
  media: LocalMedia,
  purpose: MediaPurpose,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<LocalMedia> {
  let cancellationId: string | undefined;
  const onAbort = () => {
    if (cancellationId) VideoCompressor.cancelCompression(cancellationId);
  };
  signal?.addEventListener('abort', onAbort);
  try {
    const uri = await VideoCompressor.compress(
      media.uri,
      {
        compressionMethod: 'auto',
        maxSize: VIDEO_MAX_EDGE[purpose],
        minimumFileSizeForCompress: VIDEO_COMPRESS_FROM_MB,
        getCancellationId: id => {
          cancellationId = id;
        },
      },
      onProgress,
    );
    if (uri === media.uri) return media;

    const meta = await getVideoMetaData(uri).catch(() => null);
    return {
      ...media,
      uri,
      contentType: 'video/mp4',
      fileName: withExt(media.fileName, 'mp4'),
      bytes: await sizeOf(uri, meta?.size ?? 0),
      width: meta?.width || media.width,
      height: meta?.height || media.height,
      durationMs:
        media.durationMs ??
        (meta?.duration ? Math.round(meta.duration * 1000) : undefined),
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Some Android pickers omit the duration; read it so the length limit still applies. */
async function withDuration(media: LocalMedia): Promise<LocalMedia> {
  if (media.kind !== 'video' || media.durationMs) return media;
  const meta = await getVideoMetaData(media.uri).catch(() => null);
  return meta?.duration
    ? { ...media, durationMs: Math.round(meta.duration * 1000) }
    : media;
}

/**
 * Compresses a picked file on the device so it uploads quickly and always fits
 * the server ceiling. If the device can't re-encode it, the original is used.
 */
export async function prepareMedia(
  picked: LocalMedia,
  purpose: MediaPurpose,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<LocalMedia> {
  const onProgress = opts.onProgress ?? (() => {});
  const media = await withDuration(picked);
  if (isTooLong(media, purpose)) throw new MediaError(tooLongMessage(purpose));

  let prepared = media;
  try {
    prepared =
      media.kind === 'image'
        ? await prepareImage(media, purpose)
        : await prepareVideo(media, purpose, onProgress, opts.signal);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    console.warn('Media compression failed, uploading the original', err);
  }
  onProgress(1);

  const max = MEDIA_RULES[purpose][prepared.kind]?.maxBytes ?? Infinity;
  if (prepared.bytes > max) {
    if (prepared.uri !== media.uri) await deleteFile(prepared.uri);
    throw new MediaError(
      `This ${
        prepared.kind === 'image' ? 'photo' : 'video'
      } is over ${formatBytes(
        max,
      )} and couldn't be made smaller. Try a different one.`,
    );
  }
  return prepared;
}
