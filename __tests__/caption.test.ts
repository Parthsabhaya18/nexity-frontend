import {
  activeToken,
  applySuggestion,
  countTokens,
  parseCaption,
} from '../src/features/posts/caption';
import { aspectRatioOf } from '../src/features/posts/postDraft';

describe('parseCaption', () => {
  it('highlights hashtags and mentions, leaving the rest as text', () => {
    expect(
      parseCaption('Sunset #Travel with @bob.smith. me@mail.com #123'),
    ).toEqual([
      { type: 'text', text: 'Sunset ' },
      { type: 'hashtag', text: '#Travel', value: 'travel' },
      { type: 'text', text: ' with ' },
      { type: 'mention', text: '@bob.smith', value: 'bob.smith' },
      { type: 'text', text: '. me@mail.com #123' },
    ]);
  });

  it('keeps vowel signs in non-Latin hashtags', () => {
    expect(parseCaption('#ગુજરાત')[0]).toMatchObject({
      type: 'hashtag',
      value: 'ગુજરાત',
    });
  });

  it('counts unique tokens', () => {
    expect(countTokens('#a #A #b @ann @ann @bob')).toEqual({
      hashtags: 2,
      mentions: 2,
    });
  });
});

describe('autocomplete', () => {
  it('finds the token at the cursor', () => {
    const text = 'Hello @bo and #tra';
    expect(activeToken(text, 9)).toEqual({
      trigger: '@',
      query: 'bo',
      start: 6,
      end: 9,
    });
    expect(activeToken(text, text.length)).toMatchObject({
      trigger: '#',
      query: 'tra',
    });
    expect(activeToken('mail me@x', 9)).toBeNull();
    expect(activeToken('plain text', 5)).toBeNull();
  });

  it('replaces the token with the suggestion', () => {
    const text = 'Hi @bo how are you';
    const token = activeToken(text, 6)!;
    expect(applySuggestion(text, token, 'bob.smith')).toEqual({
      text: 'Hi @bob.smith how are you',
      cursor: 14,
    });
  });
});

describe('aspectRatioOf', () => {
  it('maps frames and clamps the original shape', () => {
    expect(aspectRatioOf('square')).toBe(1);
    expect(aspectRatioOf('portrait')).toBe(0.8);
    const tall = { width: 1000, height: 3000 } as never;
    expect(aspectRatioOf('original', tall)).toBe(0.8);
    const wide = { width: 4000, height: 1000 } as never;
    expect(aspectRatioOf('original', wide)).toBe(1.91);
  });
});
