import { isTabSwipe, swipedTab } from '../src/features/profile/tabSwipe';

const TABS = ['posts', 'reels', 'saved'] as const;

describe('profile tab swipes', () => {
  it('swipe left opens the next tab, swipe right the previous one', () => {
    expect(swipedTab(TABS, 'posts', -80, 0)).toBe('reels');
    expect(swipedTab(TABS, 'reels', -80, 0)).toBe('saved');
    expect(swipedTab(TABS, 'saved', 80, 0)).toBe('reels');
    expect(swipedTab(TABS, 'reels', 80, 0)).toBe('posts');
  });

  it('stays put past the first and last tab', () => {
    expect(swipedTab(TABS, 'posts', 80, 0)).toBeNull();
    expect(swipedTab(TABS, 'saved', -80, 0)).toBeNull();
  });

  it('ignores short slow drags but accepts a quick flick', () => {
    expect(swipedTab(TABS, 'posts', -30, 0.1)).toBeNull();
    expect(swipedTab(TABS, 'posts', -30, -0.8)).toBe('reels');
  });

  it('only treats clearly sideways moves as tab swipes', () => {
    expect(isTabSwipe(40, 5)).toBe(true);
    expect(isTabSwipe(-40, 10)).toBe(true);
    expect(isTabSwipe(40, 30)).toBe(false);
    expect(isTabSwipe(10, 0)).toBe(false);
    expect(isTabSwipe(5, 80)).toBe(false);
  });
});
