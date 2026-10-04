export type MediaPurpose = 'avatar' | 'post' | 'story' | 'reel' | 'message';
export type MediaKind = 'image' | 'video';

export const CONTENT_TYPES: Record<string, MediaKind> = {
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
  /** Safety ceiling checked after compression; real files never reach it. */
  maxBytes: number;
  /** Longest video allowed, matching Instagram; `null` means no limit. */
  maxDurationMs?: number | null;
};

const SECOND = 1000;
/** Device metadata rounds durations, so a 3:00 reel may report 3:00.4. */
export const DURATION_TOLERANCE_MS = SECOND;

const IMAGE: KindRule = { maxBytes: 50 * MB };
const video = (limitMs: number | null): KindRule => ({
  maxBytes: 4 * GB,
  maxDurationMs: limitMs,
});

/** Instagram's limits. Mirror of `backend/src/modules/media/media.rules.ts`. */
export const MEDIA_RULES: Record<
  MediaPurpose,
  Partial<Record<MediaKind, KindRule>>
> = {
  avatar: { image: { maxBytes: 20 * MB } },
  /** Carousel videos; anything longer is shared as a reel. */
  post: { image: IMAGE, video: video(60 * SECOND) },
  reel: { video: video(3 * 60 * SECOND) },
  story: { image: IMAGE, video: video(60 * SECOND) },
  message: { image: IMAGE, video: video(null) },
};

/** Most files that can be picked at once for each purpose. */
export const MAX_ITEMS: Record<MediaPurpose, number> = {
  avatar: 1,
  post: 20,
  reel: 1,
  story: 10,
  message: 10,
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
};

/** Longest video edge after compression: 1080p like Instagram, 720p in chats. */
export const VIDEO_MAX_EDGE: Record<MediaPurpose, number> = {
  avatar: 1920,
  post: 1920,
  story: 1920,
  reel: 1920,
  message: 1280,
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
