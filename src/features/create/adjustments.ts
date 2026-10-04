/** Looks applied on top of a photo so every viewer sees the same edit. */
export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  sharpen: number;
  blur: number;
  vignette: number;
}

export const ZERO_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  sharpen: 0,
  blur: 0,
  vignette: 0,
};

export function hasAdjustments(value: Adjustments | null | undefined) {
  if (!value) return false;
  return Object.values(value).some(n => n !== 0);
}
