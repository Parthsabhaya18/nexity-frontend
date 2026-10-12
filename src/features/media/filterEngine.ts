import type { Adjustments } from '@/features/create/adjustments';

/**
 * Photo filters as 4×5 colour matrices (row-major, offsets 0–1, the format
 * Skia's ColorMatrix takes). The same matrix drives the live preview and the
 * baked export, so what you see is what gets posted.
 */
export type ColorMatrix = number[];

export const FILTER_IDS = [
  'normal',
  'vivid',
  'warm',
  'cool',
  'fade',
  'noir',
  'sepia',
  'dream',
  'dramatic',
] as const;
export type FilterId = (typeof FILTER_IDS)[number];

export const FILTER_LABELS: Record<FilterId, string> = {
  normal: 'Normal',
  vivid: 'Vivid',
  warm: 'Warm',
  cool: 'Cool',
  fade: 'Fade',
  noir: 'Noir',
  sepia: 'Sepia',
  dream: 'Dream',
  dramatic: 'Dramatic',
};

/** The colour edits a matrix can express; the rest of `Adjustments` is ignored here. */
export type ColorAdjustments = Partial<
  Pick<
    Adjustments,
    'brightness' | 'contrast' | 'saturation' | 'warmth' | 'fade'
  >
>;

// prettier-ignore
export const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Rec. 709 luma weights. */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** Applies `first`, then `second` (both 4×5). */
export function concat(second: ColorMatrix, first: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? second[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += second[r * 5 + k] * first[k * 5 + c];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

export const compose = (...matrices: ColorMatrix[]) =>
  matrices.reduce((acc, m) => concat(m, acc), IDENTITY);

/** 0 → identity, 1 → `m`. */
export function mix(m: ColorMatrix, amount: number): ColorMatrix {
  const t = Math.min(1, Math.max(0, amount));
  return m.map((v, i) => IDENTITY[i] + (v - IDENTITY[i]) * t);
}

export function saturationMatrix(s: number): ColorMatrix {
  const a = 1 - s;
  // prettier-ignore
  return [
    LR * a + s, LG * a,     LB * a,     0, 0,
    LR * a,     LG * a + s, LB * a,     0, 0,
    LR * a,     LG * a,     LB * a + s, 0, 0,
    0,          0,          0,          1, 0,
  ];
}

export function contrastMatrix(c: number): ColorMatrix {
  const o = (1 - c) / 2;
  // prettier-ignore
  return [
    c, 0, 0, 0, o,
    0, c, 0, 0, o,
    0, 0, c, 0, o,
    0, 0, 0, 1, 0,
  ];
}

export function brightnessMatrix(b: number): ColorMatrix {
  // prettier-ignore
  return [
    1, 0, 0, 0, b,
    0, 1, 0, 0, b,
    0, 0, 1, 0, b,
    0, 0, 0, 1, 0,
  ];
}

/** Per-channel gain and offset. */
function channels(
  [rg, gg, bg]: [number, number, number],
  [ro, go, bo]: [number, number, number] = [0, 0, 0],
): ColorMatrix {
  // prettier-ignore
  return [
    rg, 0,  0,  0, ro,
    0,  gg, 0,  0, go,
    0,  0,  bg, 0, bo,
    0,  0,  0,  1, 0,
  ];
}

// prettier-ignore
const SEPIA: ColorMatrix = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0,     0,     0,     1, 0,
];

const PRESETS: Record<FilterId, ColorMatrix> = {
  normal: IDENTITY,
  vivid: compose(saturationMatrix(1.45), contrastMatrix(1.12)),
  warm: compose(
    channels([1.08, 1.02, 0.86], [0.03, 0.01, 0]),
    saturationMatrix(1.08),
  ),
  cool: compose(
    channels([0.88, 1, 1.1], [0, 0.01, 0.04]),
    saturationMatrix(0.95),
  ),
  fade: compose(
    saturationMatrix(0.8),
    contrastMatrix(0.82),
    brightnessMatrix(0.05),
  ),
  noir: compose(
    saturationMatrix(0),
    contrastMatrix(1.3),
    brightnessMatrix(-0.02),
  ),
  sepia: compose(SEPIA, contrastMatrix(1.05)),
  dream: compose(
    saturationMatrix(0.85),
    contrastMatrix(0.88),
    channels([1.04, 0.98, 1.06], [0.06, 0.04, 0.08]),
  ),
  dramatic: compose(
    contrastMatrix(1.38),
    saturationMatrix(0.88),
    brightnessMatrix(-0.04),
  ),
};

/** A filter at `intensity` 0–100 (100 = full strength). */
export function filterMatrix(id: FilterId, intensity = 100): ColorMatrix {
  return mix(PRESETS[id], intensity / 100);
}

/** Adjustment sliders run from -100 to 100 (fade 0–100); 0 changes nothing. */
export function adjustmentMatrix(a: ColorAdjustments = {}): ColorMatrix {
  const t = (v: number | undefined) =>
    Math.min(1, Math.max(-1, (v ?? 0) / 100));
  const parts: ColorMatrix[] = [];
  const brightness = t(a.brightness);
  const contrast = t(a.contrast);
  const saturation = t(a.saturation);
  const warmth = t(a.warmth);
  const fade = Math.max(0, t(a.fade));
  if (brightness) parts.push(brightnessMatrix(brightness * 0.25));
  if (contrast) parts.push(contrastMatrix(1 + contrast * 0.5));
  if (saturation) parts.push(saturationMatrix(1 + saturation));
  if (warmth) {
    parts.push(
      channels([1, 1, 1], [warmth * 0.08, warmth * 0.02, -warmth * 0.08]),
    );
  }
  if (fade)
    parts.push(
      compose(contrastMatrix(1 - fade * 0.25), brightnessMatrix(fade * 0.08)),
    );
  return compose(...parts);
}

/** The single matrix for a filter plus adjustments (filter first). */
export function lookMatrix(
  filter: FilterId = 'normal',
  intensity = 100,
  adjustments?: ColorAdjustments,
): ColorMatrix {
  return compose(
    filterMatrix(filter, intensity),
    adjustmentMatrix(adjustments),
  );
}

export const isIdentity = (m: ColorMatrix) =>
  m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6);

/** Applies a matrix to one RGB colour (0–1); used by tests and swatches. */
export function applyToColor(
  m: ColorMatrix,
  [r, g, b]: [number, number, number],
): [number, number, number] {
  const ch = (row: number) =>
    Math.min(
      1,
      Math.max(
        0,
        m[row * 5] * r +
          m[row * 5 + 1] * g +
          m[row * 5 + 2] * b +
          m[row * 5 + 3] +
          m[row * 5 + 4],
      ),
    );
  return [ch(0), ch(1), ch(2)];
}
