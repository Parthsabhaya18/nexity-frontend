/**
 * Geometry for placing a photo on a fixed-ratio canvas (Stories 9:16, posts
 * 1:1 / 4:5 / 1.91:1). Close enough to the canvas ratio → fill it; otherwise
 * fit the whole photo over a blurred copy of itself. Never stretched.
 */

export type FitMode = 'fit' | 'fill';

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Zoom and pan on top of the fit/fill base scale; offsets are fractions of the canvas. */
export interface FitTransform {
  mode: FitMode;
  zoom: number;
  /** Horizontal offset of the photo's centre, as a fraction of the canvas width. */
  x: number;
  /** Vertical offset, as a fraction of the canvas height. */
  y: number;
}

export const STORY_RATIO = 9 / 16;
export const STORY_CANVAS: Size = { width: 1080, height: 1920 };
/** Exported photos are at most this wide (Stories, Reels covers and posts). */
export const EXPORT_MAX_WIDTH = 1080;
export const EXPORT_QUALITY = 0.8;
/** Within 5% of the canvas ratio a photo fills it without a visible crop. */
export const FIT_TOLERANCE = 0.05;
export const MAX_ZOOM = 4;

export const IDENTITY_TRANSFORM: Omit<FitTransform, 'mode'> = {
  zoom: 1,
  x: 0,
  y: 0,
};

export const ratioOf = (s: Size) => (s.height > 0 ? s.width / s.height : 1);

/** Output size for a canvas ratio (width / height), at most `maxWidth` wide. */
export function canvasFor(ratio: number, maxWidth = EXPORT_MAX_WIDTH): Size {
  return { width: maxWidth, height: Math.round(maxWidth / ratio) };
}

export function ratioMatches(
  source: Size,
  ratio: number,
  tolerance = FIT_TOLERANCE,
) {
  return Math.abs(ratioOf(source) / ratio - 1) <= tolerance;
}

export function defaultFitMode(source: Size, ratio: number): FitMode {
  return ratioMatches(source, ratio) ? 'fill' : 'fit';
}

/** Scale that shows the whole photo (fit) or covers the whole canvas (fill). */
export function baseScale(source: Size, frame: Size, mode: FitMode) {
  const sx = frame.width / source.width;
  const sy = frame.height / source.height;
  return mode === 'fill' ? Math.max(sx, sy) : Math.min(sx, sy);
}

/** Size of the photo on the canvas at zoom 1. */
export function baseSize(source: Size, frame: Size, mode: FitMode): Size {
  const s = baseScale(source, frame, mode);
  return { width: source.width * s, height: source.height * s };
}

/**
 * Keeps the photo from leaving gaps: it can only move as far as it overflows
 * the canvas on each axis (in canvas pixels).
 */
export function clampPan(
  displayed: Size,
  frame: Size,
  x: number,
  y: number,
): { x: number; y: number } {
  const maxX = Math.max(0, (displayed.width - frame.width) / 2);
  const maxY = Math.max(0, (displayed.height - frame.height) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

export function clampTransform(
  source: Size,
  frame: Size,
  t: FitTransform,
): FitTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, t.zoom));
  const base = baseSize(source, frame, t.mode);
  const p = clampPan(
    { width: base.width * zoom, height: base.height * zoom },
    frame,
    t.x * frame.width,
    t.y * frame.height,
  );
  return { mode: t.mode, zoom, x: p.x / frame.width, y: p.y / frame.height };
}

/** Where the sharp photo is drawn on a canvas of `frame` size. */
export function placement(source: Size, frame: Size, t: FitTransform): Rect {
  const base = baseSize(source, frame, t.mode);
  const width = base.width * t.zoom;
  const height = base.height * t.zoom;
  return {
    x: (frame.width - width) / 2 + t.x * frame.width,
    y: (frame.height - height) / 2 + t.y * frame.height,
    width,
    height,
  };
}

/** The blurred background: the same photo scaled to cover, centred. */
export function backgroundPlacement(source: Size, frame: Size): Rect {
  const s = baseSize(source, frame, 'fill');
  return {
    x: (frame.width - s.width) / 2,
    y: (frame.height - s.height) / 2,
    width: s.width,
    height: s.height,
  };
}

/** True when the sharp photo leaves part of the canvas uncovered. */
export function needsBackground(rect: Rect, frame: Size) {
  const e = 0.5;
  return (
    rect.x > e ||
    rect.y > e ||
    rect.x + rect.width < frame.width - e ||
    rect.y + rect.height < frame.height - e
  );
}

/** EXIF orientations 5–8 store the photo rotated by 90°. */
export function orientedSize(raw: Size, exifOrientation?: number): Size {
  return exifOrientation && exifOrientation >= 5 && exifOrientation <= 8
    ? { width: raw.height, height: raw.width }
    : raw;
}
