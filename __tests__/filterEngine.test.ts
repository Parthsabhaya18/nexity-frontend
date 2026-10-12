import {
  adjustmentMatrix,
  applyToColor,
  compose,
  FILTER_IDS,
  filterMatrix,
  IDENTITY,
  isIdentity,
  lookMatrix,
  saturationMatrix,
} from '@/features/media/filterEngine';

const grey: [number, number, number] = [0.5, 0.5, 0.5];
const red: [number, number, number] = [0.8, 0.2, 0.2];

describe('filterEngine', () => {
  it('has the nine filters, Normal being a no-op', () => {
    expect(FILTER_IDS).toEqual([
      'normal', 'vivid', 'warm', 'cool', 'fade', 'noir', 'sepia', 'dream', 'dramatic',
    ]);
    expect(isIdentity(filterMatrix('normal'))).toBe(true);
    for (const id of FILTER_IDS) expect(filterMatrix(id)).toHaveLength(20);
  });

  it('scales every filter by intensity: 0 = original, 100 = full', () => {
    for (const id of FILTER_IDS) {
      expect(isIdentity(filterMatrix(id, 0))).toBe(true);
    }
    const half = applyToColor(filterMatrix('noir', 50), red);
    const full = applyToColor(filterMatrix('noir', 100), red);
    expect(half[0]).toBeGreaterThan(full[0]);
    expect(half[0]).toBeLessThan(red[0]);
  });

  it('noir is greyscale, warm adds red, cool adds blue', () => {
    const [r, g, b] = applyToColor(filterMatrix('noir'), red);
    expect(r).toBeCloseTo(g, 6);
    expect(g).toBeCloseTo(b, 6);
    const warm = applyToColor(filterMatrix('warm'), grey);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    const cool = applyToColor(filterMatrix('cool'), grey);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it('adjustments: 0 changes nothing, each slider moves the right way', () => {
    expect(isIdentity(adjustmentMatrix({}))).toBe(true);
    expect(isIdentity(adjustmentMatrix({ brightness: 0, contrast: 0 }))).toBe(true);
    expect(applyToColor(adjustmentMatrix({ brightness: 50 }), grey)[0]).toBeGreaterThan(0.5);
    expect(applyToColor(adjustmentMatrix({ brightness: -50 }), grey)[0]).toBeLessThan(0.5);
    const dark: [number, number, number] = [0.2, 0.2, 0.2];
    expect(applyToColor(adjustmentMatrix({ contrast: 60 }), dark)[0]).toBeLessThan(0.2);
    const desat = applyToColor(adjustmentMatrix({ saturation: -100 }), red);
    expect(desat[0]).toBeCloseTo(desat[1], 6);
    const warm = applyToColor(adjustmentMatrix({ warmth: 80 }), grey);
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });

  it('composes in order, matching applying one after the other', () => {
    const a = saturationMatrix(0);
    const b = adjustmentMatrix({ brightness: 40 });
    const step = applyToColor(b, applyToColor(a, red));
    const once = applyToColor(compose(a, b), red);
    once.forEach((v, i) => expect(v).toBeCloseTo(step[i], 6));
    expect(compose()).toEqual(IDENTITY);
  });

  it('lookMatrix = filter at intensity, then adjustments', () => {
    const look = lookMatrix('sepia', 70, { contrast: 20 });
    const manual = compose(filterMatrix('sepia', 70), adjustmentMatrix({ contrast: 20 }));
    look.forEach((v, i) => expect(v).toBeCloseTo(manual[i], 9));
  });
});
