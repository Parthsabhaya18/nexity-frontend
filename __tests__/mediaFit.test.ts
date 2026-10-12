import {
  backgroundPlacement,
  canvasFor,
  clampTransform,
  defaultFitMode,
  needsBackground,
  orientedSize,
  placement,
  STORY_CANVAS,
  STORY_RATIO,
} from '@/features/media/mediaFit';

const landscape = { width: 4032, height: 3024 };
const portrait = { width: 3024, height: 4032 };
const square = { width: 2000, height: 2000 };
const almostStory = { width: 1080, height: 1900 };
const frame = STORY_CANVAS;
const at1 = { zoom: 1, x: 0, y: 0 };

describe('mediaFit', () => {
  it('outputs 1080x1920 for stories and keeps posts 1080 wide', () => {
    expect(canvasFor(STORY_RATIO)).toEqual({ width: 1080, height: 1920 });
    expect(canvasFor(4 / 5)).toEqual({ width: 1080, height: 1350 });
    expect(canvasFor(1)).toEqual({ width: 1080, height: 1080 });
  });

  it('fills only within 5% of the canvas ratio, otherwise fits', () => {
    expect(defaultFitMode(almostStory, STORY_RATIO)).toBe('fill');
    expect(defaultFitMode(landscape, STORY_RATIO)).toBe('fit');
    expect(defaultFitMode(portrait, STORY_RATIO)).toBe('fit');
    expect(defaultFitMode(square, 1)).toBe('fill');
    expect(defaultFitMode({ width: 1000, height: 1040 }, 1)).toBe('fill');
    expect(defaultFitMode({ width: 1000, height: 1060 }, 1)).toBe('fit');
  });

  it.each([
    ['landscape', landscape],
    ['portrait', portrait],
    ['square', square],
  ])('never stretches a %s photo in fit or fill', (_name, src) => {
    for (const mode of ['fit', 'fill'] as const) {
      const r = placement(src, frame, { mode, ...at1 });
      expect(r.width / r.height).toBeCloseTo(src.width / src.height, 6);
    }
  });

  it('fit shows the whole photo centred over the blurred copy', () => {
    const r = placement(landscape, frame, { mode: 'fit', ...at1 });
    expect(r.width).toBeCloseTo(1080);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo((1920 - 810) / 2);
    expect(needsBackground(r, frame)).toBe(true);

    const bg = backgroundPlacement(landscape, frame);
    expect(bg.height).toBeCloseTo(1920);
    expect(bg.width).toBeGreaterThanOrEqual(1080);
  });

  it('fill covers the whole canvas with no gaps', () => {
    for (const src of [landscape, portrait, square]) {
      const r = placement(src, frame, { mode: 'fill', ...at1 });
      expect(needsBackground(r, frame)).toBe(false);
    }
  });

  it('clamps zoom and pan so fill never shows a gap', () => {
    const t = clampTransform(landscape, frame, { mode: 'fill', zoom: 9, x: 5, y: -5 });
    expect(t.zoom).toBe(4);
    const r = placement(landscape, frame, t);
    expect(needsBackground(r, frame)).toBe(false);
    expect(r.x).toBeCloseTo(0);
    expect(r.y + r.height).toBeCloseTo(1920);

    const fit = clampTransform(landscape, frame, { mode: 'fit', zoom: 0.5, x: 0.3, y: 0.3 });
    expect(fit).toEqual({ mode: 'fit', zoom: 1, x: 0, y: 0 });
  });

  it('swaps width and height for rotated EXIF orientations', () => {
    expect(orientedSize({ width: 4032, height: 3024 }, 6)).toEqual({ width: 3024, height: 4032 });
    expect(orientedSize({ width: 4032, height: 3024 }, 1)).toEqual({ width: 4032, height: 3024 });
    expect(orientedSize({ width: 4032, height: 3024 })).toEqual({ width: 4032, height: 3024 });
  });
});
