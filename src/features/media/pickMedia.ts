import {
  type Asset,
  type ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
  type MediaType,
} from 'react-native-image-picker';

import {
  ensureAccess,
  requestAccess,
  showPermissionPrompt,
  type PermissionKind,
} from './permissionPrompt';
import {
  allowedKinds,
  CONTENT_TYPES,
  DURATION_TOLERANCE_MS,
  formatBytes,
  formatDuration,
  MAX_ITEMS,
  maxDurationMs,
  MEDIA_RULES,
  type MediaKind,
  type MediaPurpose,
  resolveContentType,
} from './mediaRules';

/** A photo or video on the device, ready for `uploadMedia`. */
export interface LocalMedia {
  uri: string;
  kind: MediaKind;
  contentType: string;
  fileName: string;
  /** 0 when the picker could not report a size. */
  bytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

/** User-facing problem with the picked file; show `message` as-is. */
export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaError';
  }
}

function mediaTypeFor(purpose: MediaPurpose, only?: MediaKind): MediaType {
  const kinds = only ? [only] : allowedKinds(purpose);
  if (kinds.length > 1) return 'mixed';
  return kinds[0] === 'video' ? 'video' : 'photo';
}

const VIDEO_LABEL: Record<MediaPurpose, string> = {
  avatar: 'Profile videos',
  post: 'Videos in a post',
  reel: 'Reels',
  story: 'Story videos',
  message: 'Videos in messages',
};

export function tooLongMessage(purpose: MediaPurpose) {
  const max = maxDurationMs(purpose) ?? 0;
  return `${VIDEO_LABEL[purpose]} can be up to ${formatDuration(max)}. Choose a shorter video.`;
}

const KIND_LABEL: Record<MediaKind, string> = {
  image: 'Photos',
  video: 'Videos',
  audio: 'Voice messages',
};

export function tooLargeMessage(kind: MediaKind, maxBytes: number) {
  if (kind === 'audio') {
    return `Voice messages can be up to ${formatBytes(maxBytes)}.`;
  }
  return `${KIND_LABEL[kind]} can be up to ${formatBytes(
    maxBytes,
  )}. This one is still larger after compressing. Choose a smaller file.`;
}

export function isTooLong(media: LocalMedia, purpose: MediaPurpose) {
  const max = maxDurationMs(purpose);
  return (
    media.kind === 'video' &&
    !!max &&
    !!media.durationMs &&
    media.durationMs > max + DURATION_TOLERANCE_MS
  );
}

/**
 * Kind and video length are checked on pick. Size is checked by `prepareMedia`
 * after compression, because most originals shrink well under the limit.
 */
export function validateMedia(media: LocalMedia, purpose: MediaPurpose) {
  if (!MEDIA_RULES[purpose][media.kind]) {
    throw new MediaError(`${KIND_LABEL[media.kind]} can't be used here.`);
  }
  if (isTooLong(media, purpose)) throw new MediaError(tooLongMessage(purpose));
}

function toLocalMedia(asset: Asset): LocalMedia {
  const contentType = resolveContentType(asset.type, asset.fileName);
  if (!asset.uri || !contentType) {
    throw new MediaError(
      "This file type isn't supported. Choose a photo or a video.",
    );
  }
  const ext =
    contentType === 'video/quicktime' ? 'mov' : contentType.split('/')[1];
  return {
    uri: asset.uri,
    kind: CONTENT_TYPES[contentType],
    contentType,
    fileName: asset.fileName ?? `upload.${ext}`,
    bytes: asset.fileSize ?? 0,
    width: asset.width || undefined,
    height: asset.height || undefined,
    durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
  };
}

function handleResponse(
  res: ImagePickerResponse,
  purpose: MediaPurpose,
  access: 'camera' | 'photos',
): LocalMedia[] {
  if (res.didCancel) return [];
  if (res.errorCode === 'permission') {
    const detail = (res.errorMessage ?? '').toLowerCase();
    const kind: PermissionKind =
      detail.includes('microphone') || detail.includes('audio')
        ? 'microphone'
        : access;
    showPermissionPrompt(kind);
    return [];
  }
  if (res.errorCode === 'camera_unavailable') {
    throw new MediaError('The camera is not available on this device.');
  }
  if (res.errorCode) {
    throw new MediaError(
      res.errorMessage || "Something went wrong. Couldn't open the file.",
    );
  }
  return (res.assets ?? []).map(toLocalMedia);
}

function acceptPicked(
  items: LocalMedia[],
  purpose: MediaPurpose,
  allowLong: boolean,
) {
  items.forEach(media => {
    if (allowLong && media.kind === 'video') {
      if (!MEDIA_RULES[purpose][media.kind]) {
        throw new MediaError('That file type is not supported.');
      }
      return;
    }
    validateMedia(media, purpose);
  });
  return items;
}

/**
 * Opens the system photo picker and returns the originals; compression happens
 * once, in `prepareMedia`. iOS HEIC/MOV are exported as JPEG/MP4. `[]` on cancel.
 * At most `MAX_ITEMS[purpose]` files can be selected (Instagram: 20 per post).
 */
export async function pickFromLibrary(
  purpose: MediaPurpose,
  opts: { kind?: MediaKind; limit?: number; allowLong?: boolean } = {},
): Promise<LocalMedia[]> {
  const max = MAX_ITEMS[purpose];
  const res = await launchImageLibrary({
    mediaType: mediaTypeFor(purpose, opts.kind),
    selectionLimit: Math.min(opts.limit ?? max, max),
    videoQuality: 'high',
    assetRepresentationMode: 'compatible',
    formatAsMp4: true,
  });
  return acceptPicked(
    handleResponse(res, purpose, 'photos'),
    purpose,
    !!opts.allowLong,
  );
}

/**
 * Opens the camera for one photo or video. Recording stops by itself at the
 * purpose's length limit, like Instagram. Returns `null` on cancel.
 */
export async function captureWithCamera(
  purpose: MediaPurpose,
  kind: MediaKind,
): Promise<LocalMedia | null> {
  if (!(await ensureAccess('camera'))) return null;
  if (kind === 'video') await requestAccess('microphone');
  const maxMs = kind === 'video' ? maxDurationMs(purpose) : null;
  const res = await launchCamera({
    mediaType: kind === 'image' ? 'photo' : 'video',
    ...(maxMs ? { durationLimit: maxMs / 1000 } : {}),
    videoQuality: 'high',
    saveToPhotos: false,
    formatAsMp4: true,
  });
  return (
    acceptPicked(handleResponse(res, purpose, 'camera'), purpose, false)[0] ??
    null
  );
}
