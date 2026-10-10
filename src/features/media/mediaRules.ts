export type MediaPurpose =
  | 'avatar'
  | 'post'
  | 'story'
  | 'reel'
  | 'message'
  | 'support';
export type MediaKind = 'image' | 'video' | 'audio';

export const CONTENT_TYPES: Record<string, MediaKind> = {
  'audio/mp4': 'audio',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
};

const ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'video/mov': 'video/quicktime',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/aac': 'audio/mp4',
};

const EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
};

/** Resolves the MIME type from the picker's value, falling back to the file extension. */
export function resolveContentType(type?: string, fileName?: string) {
  const fromType = type?.split(';')[0]?.trim().toLowerCase();
  if (fromType) {
    const normalized = ALIASES[fromType] ?? fromType;
    if (normalized in CONTENT_TYPES) return normalized;
  }
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return ext ? EXTENSIONS[ext] ?? null : null;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

type KindRule = {
  /** Largest file that may be uploaded, checked after on-device compression. */
  maxBytes: number;
  /** Longest video allowed, matching Instagram; `null` means no limit. */
  maxDurationMs?: number | null;
};

const SECOND = 1000;
/** Device metadata rounds durations, so a 3:00 reel may report 3:00.4. */
export const DURATION_TOLERANCE_MS = SECOND;

/** Posts, reels, stories and chat videos all stop at 2 minutes. */
export const VIDEO_MAX_MS = 120 * SECOND;

export const IMAGE_MAX_BYTES = 10 * MB;
export const VIDEO_MAX_BYTES = 200 * MB;
/** Story photos share the video ceiling. */
export const STORY_IMAGE_MAX_BYTES = 200 * MB;
export const VOICE_MAX_BYTES = 10 * MB;
/** Contact us screenshots. */
export const SUPPORT_IMAGE_MAX_BYTES = 5 * MB;
/** Longest voice message, like Instagram. */
export const VOICE_MAX_MS = 60 * SECOND;

const IMAGE: KindRule = { maxBytes: IMAGE_MAX_BYTES };
const video = (limitMs: number | null): KindRule => ({
  maxBytes: VIDEO_MAX_BYTES,
  maxDurationMs: limitMs,
});

/** Upload limits. Mirror of `backend/src/modules/media/media.rules.ts`. */
export const MEDIA_RULES: Record<
  MediaPurpose,
  Partial<Record<MediaKind, KindRule>>
> = {
  avatar: { image: IMAGE },
  post: { image: IMAGE, video: video(VIDEO_MAX_MS) },
  reel: { video: video(VIDEO_MAX_MS) },
  story: {
    image: { maxBytes: STORY_IMAGE_MAX_BYTES },
    video: video(VIDEO_MAX_MS),
  },
  message: {
    image: IMAGE,
    video: video(VIDEO_MAX_MS),
    audio: { maxBytes: VOICE_MAX_BYTES, maxDurationMs: VOICE_MAX_MS },
  },
  support: { image: { maxBytes: SUPPORT_IMAGE_MAX_BYTES } },
};

export function maxBytesFor(purpose: MediaPurpose, kind: MediaKind) {
  return MEDIA_RULES[purpose][kind]?.maxBytes ?? 0;
}

/** Most files that can be picked at once for each purpose. */
export const MAX_ITEMS: Record<MediaPurpose, number> = {
  avatar: 1,
  post: 20,
  reel: 1,
  story: 10,
  message: 10,
  support: 4,
};

/** Videos smaller than this are uploaded as they are. */
export const VIDEO_COMPRESS_FROM_MB = 10;

/** Longest image edge after on-device resize (Instagram: 1080 wide, stories 1080×1920). */
export const IMAGE_MAX_EDGE: Record<MediaPurpose, number> = {
  avatar: 640,
  post: 1440,
  story: 1920,
  reel: 1920,
  message: 1600,
  support: 1600,
};

/** Longest video edge after compression: 720p for every purpose. */
export const VIDEO_MAX_EDGE: Record<MediaPurpose, number> = {
  avatar: 1280,
  post: 1280,
  story: 1280,
  reel: 1280,
  message: 1280,
  support: 1280,
};

export function maxDurationMs(purpose: MediaPurpose) {
  return MEDIA_RULES[purpose].video?.maxDurationMs ?? null;
}

export function formatDuration(ms: number) {
  const total = Math.round(ms / SECOND);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (total <= 60) return `${total} seconds`;
  if (!sec) return `${min} minute${min === 1 ? '' : 's'}`;
  return `${min}:${String(sec).padStart(2, '0')} minutes`;
}

export function allowedKinds(purpose: MediaPurpose): MediaKind[] {
  return (['image', 'video'] as const).filter(k => MEDIA_RULES[purpose][k]);
}

export function formatBytes(bytes: number) {
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  return bytes >= MB
    ? `${Math.round(bytes / MB)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
