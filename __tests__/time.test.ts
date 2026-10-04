import { presenceLabel } from '../src/utils/time';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('presenceLabel', () => {
  it('says "Active now" while online, never "now ago"', () => {
    expect(presenceLabel(true, ago(5_000))).toBe('Active now');
    expect(presenceLabel(false, ago(5_000))).toBe('Active just now');
  });

  it('uses compact relative time when offline', () => {
    expect(presenceLabel(false, ago(5 * 60_000))).toBe('Active 5m ago');
    expect(presenceLabel(false, ago(3 * 3_600_000))).toBe('Active 3h ago');
    expect(presenceLabel(false, ago(2 * 86_400_000))).toBe('Active 2d ago');
  });

  it('hides old or unknown activity', () => {
    expect(presenceLabel(false, ago(10 * 86_400_000))).toBeNull();
    expect(presenceLabel(false, null)).toBeNull();
  });
});
