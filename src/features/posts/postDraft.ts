import { useSyncExternalStore } from 'react';

import {
  ZERO_ADJUSTMENTS,
  type Adjustments,
} from '@/features/create/adjustments';
import type { LocalMedia } from '@/features/media/pickMedia';
import type { UserSummary } from '@/services/api/follows';

/** Frame shapes Instagram offers when cropping a post. */
export type AspectOption = 'square' | 'portrait' | 'landscape' | 'original';

export const ASPECT_LABELS: Record<AspectOption, string> = {
  square: '1:1',
  portrait: '4:5',
  landscape: '16:9',
  original: 'Original',
};

/** Feed media is shown between 4:5 portrait and 1.91:1 landscape. */
export const MIN_ASPECT = 0.8;
export const MAX_ASPECT = 1.91;

/** Pinch position inside the crop frame. `x` and `y` are in frame pixels. */
export interface CropTransform {
  scale: number;
  x: number;
  y: number;
}

export const IDENTITY_CROP: CropTransform = { scale: 1, x: 0, y: 0 };

export interface DraftItem {
  key: string;
  media: LocalMedia;
  altText: string;
  crop: CropTransform;
  /** Frame size the crop was made in, so share can cut the same rectangle. */
  frameWidth?: number;
  frameHeight?: number;
}

export interface PostDraft {
  items: DraftItem[];
  aspect: AspectOption;
  caption: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  adjustments: Adjustments;
  /** People picked in Tag people; saved on the post. */
  tagged: UserSummary[];
  hideLikeCount: boolean;
  commentsDisabled: boolean;
}

const EMPTY: PostDraft = {
  items: [],
  aspect: 'square',
  caption: '',
  location: '',
  locationLat: null,
  locationLng: null,
  adjustments: ZERO_ADJUSTMENTS,
  tagged: [],
  hideLikeCount: false,
  commentsDisabled: false,
};

let draft = EMPTY;
const listeners = new Set<() => void>();
let nextKey = 0;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function getDraft() {
  return draft;
}

export function updateDraft(
  change: Partial<PostDraft> | ((current: PostDraft) => Partial<PostDraft>),
) {
  const patch = typeof change === 'function' ? change(draft) : change;
  draft = { ...draft, ...patch };
  listeners.forEach(l => l());
}

export function resetDraft() {
  draft = EMPTY;
  listeners.forEach(l => l());
}

export function toDraftItems(medias: LocalMedia[]): DraftItem[] {
  return medias.map(media => ({
    key: `draft-${++nextKey}`,
    media,
    altText: '',
    crop: IDENTITY_CROP,
  }));
}

/** Shared between the crop and details screens of the create flow. */
export function usePostDraft() {
  return useSyncExternalStore(subscribe, getDraft);
}

const clamp = (n: number) => Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, n));

/** Width / height of the frame; "Original" follows the first photo, like Instagram. */
export function aspectRatioOf(aspect: AspectOption, first?: LocalMedia) {
  switch (aspect) {
    case 'square':
      return 1;
    case 'portrait':
      return 0.8;
    case 'landscape':
      return 16 / 9;
    case 'original':
      return first?.width && first.height
        ? clamp(first.width / first.height)
        : 1;
  }
}
