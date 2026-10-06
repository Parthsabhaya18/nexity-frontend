import {
  consumeFocusedReel,
  focusReel,
  focusReelId,
  keepPinnedFirst,
} from '../src/features/reels/reelFocus';
import type { Reel } from '../src/services/api/reels';

const r = (id: string, likes = 0) => ({ id, likes });

describe('keepPinnedFirst', () => {
  it('puts a reel opened from a profile back on top after the feed replaced the list', () => {
    const pin = r('p');
    expect(keepPinnedFirst([r('a'), r('b')], pin)).toEqual([pin, r('a'), r('b')]);
  });

  it('keeps the copy from the feed so likes stay current', () => {
    const fresh = r('p', 5);
    expect(keepPinnedFirst([r('a'), fresh], r('p', 0))).toEqual([fresh, r('a')]);
  });

  it('drops a repeat that arrives with a later page', () => {
    const pin = r('p', 2);
    expect(keepPinnedFirst([pin, r('a'), r('p', 0), r('b')], r('p'))).toEqual([
      pin,
      r('a'),
      r('b'),
    ]);
  });

  it('changes nothing when the reel is already first and only once', () => {
    expect(keepPinnedFirst([r('p'), r('a')], r('p'))).toBeNull();
  });

  it('works on an empty list (feed still loading or empty)', () => {
    expect(keepPinnedFirst([], r('p'))).toEqual([r('p')]);
  });
});

describe('focus queue', () => {
  it('hands the tapped reel to the Reels tab exactly once', () => {
    const reel = { id: 'x', video_url: 'https://cdn.test/x.mp4' } as Reel;
    focusReel(reel);
    expect(consumeFocusedReel()).toBe(reel);
    expect(consumeFocusedReel()).toBeNull();
  });

  it('keeps only the id for notifications, and the latest request wins', () => {
    focusReel({ id: 'old', video_url: 'u' } as Reel);
    focusReelId('new');
    expect(consumeFocusedReel()).toEqual({ id: 'new' });
  });
});
