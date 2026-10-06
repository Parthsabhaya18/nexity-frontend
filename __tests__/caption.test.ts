import {
  activeToken,
  applySuggestion,
  countMentions,
  parseCaption,
} from '../src/features/posts/caption';
import { aspectRatioOf } from '../src/features/posts/postDraft';

describe('parseCaption', () => {
  it('highlights mentions, leaving hashtags and the rest as text', () => {
    expect(parseCaption('Sunset #Travel with @bob.smith. me@mail.com')).toEqual([
      { type: 'text', text: 'Sunset #Travel with ' },
      { type: 'mention', text: '@bob.smith', value: 'bob.smith' },
      { type: 'text', text: '. me@mail.com' },
    ]);
  });

  it('counts unique mentions', () => {
    expect(countMentions('#a @ann @Ann @bob')).toBe(2);
    expect(countMentions('wow...@ann wow…@bob hi@cat')).toBe(0);
    expect(countMentions('(@ann) and\n@bob')).toBe(2);
  });
});

describe('autocomplete', () => {
  it('finds the mention at the cursor', () => {
    const text = 'Hello @bo and #tra';
    expect(activeToken(text, 9)).toEqual({ query: 'bo', start: 6, end: 9 });
    expect(activeToken(text, text.length)).toBeNull();
    expect(activeToken('mail me@x', 9)).toBeNull();
    expect(activeToken('plain text', 5)).toBeNull();
    expect(activeToken('Hi @', 4)).toEqual({ query: '', start: 3, end: 4 });
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
