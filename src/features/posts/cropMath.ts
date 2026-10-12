import type { LocalMedia } from '@/features/media/pickMedia';

import type { CropTransform } from './postDraft';

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The rectangle of the original photo that the crop frame shows.
 * The photo is cover-fitted, then scaled and panned like the preview.
 */
export function cropRect(
  media: Pick<LocalMedia, 'width' | 'height'>,
  crop: CropTransform,
  frameWidth: number,
  frameHeight: number,
): PixelRect | null {
  const iw = media.width ?? 0;
  const ih = media.height ?? 0;
  if (iw < 2 || ih < 2 || frameWidth < 2 || frameHeight < 2) return null;

  const userScale = Math.min(4, Math.max(1, crop.scale));
  const base = Math.max(frameWidth / iw, frameHeight / ih);
  const scale = base * userScale;
  const displayedW = iw * scale;
  const displayedH = ih * scale;
  const maxX = Math.max(0, (displayedW - frameWidth) / 2);
  const maxY = Math.max(0, (displayedH - frameHeight) / 2);
  const x = Math.min(maxX, Math.max(-maxX, crop.x));
  const y = Math.min(maxY, Math.max(-maxY, crop.y));
  const left = (frameWidth - displayedW) / 2 + x;
  const top = (frameHeight - displayedH) / 2 + y;

  let px = (0 - left) / scale;
  let py = (0 - top) / scale;
  let pw = frameWidth / scale;
  let ph = frameHeight / scale;
  px = Math.max(0, Math.min(px, iw - 1));
  py = Math.max(0, Math.min(py, ih - 1));
  pw = Math.max(1, Math.min(pw, iw - px));
  ph = Math.max(1, Math.min(ph, ih - py));
  return {
    x: Math.round(px),
    y: Math.round(py),
    width: Math.max(1, Math.round(pw)),
    height: Math.max(1, Math.round(ph)),
  };
}
