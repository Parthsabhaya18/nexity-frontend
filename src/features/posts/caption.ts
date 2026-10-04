/** Instagram's limits; the API enforces the same. */
export const CAPTION_MAX = 2200;
export const MAX_HASHTAGS = 30;
export const MAX_MENTIONS = 20;
export const ALT_TEXT_MAX = 100;
export const LOCATION_MAX = 100;

const TAG_CHARS = '\\p{L}\\p{M}\\p{N}_';
const HASHTAG_RE = new RegExp(
  `(^|[^${TAG_CHARS}&])#([${TAG_CHARS}]{1,100})`,
  'gu',
);
const MENTION_RE = /(^|[^\w.@])@([a-z0-9._]{1,30})/gi;

export type CaptionSegment =
  | { type: 'text'; text: string }
  | { type: 'hashtag' | 'mention'; text: string; value: string };

/** Splits a caption into plain text, `#hashtags` and `@mentions` for highlighting. */
export function parseCaption(caption: string): CaptionSegment[] {
  const marks: { start: number; end: number; type: 'hashtag' | 'mention' }[] =
    [];
  for (const m of caption.matchAll(HASHTAG_RE)) {
    const start = m.index! + m[1]!.length;
    if (/^\d+$/.test(m[2]!)) continue;
    marks.push({ start, end: start + 1 + m[2]!.length, type: 'hashtag' });
  }
  for (const m of caption.matchAll(MENTION_RE)) {
    const name = m[2]!.replace(/\.+$/, '');
    if (name.length < 3) continue;
    const start = m.index! + m[1]!.length;
    marks.push({ start, end: start + 1 + name.length, type: 'mention' });
  }
  marks.sort((a, b) => a.start - b.start);

  const segments: CaptionSegment[] = [];
  let pos = 0;
  for (const mark of marks) {
    if (mark.start < pos) continue;
    if (mark.start > pos) {
      segments.push({ type: 'text', text: caption.slice(pos, mark.start) });
    }
    const text = caption.slice(mark.start, mark.end);
    segments.push({
      type: mark.type,
      text,
      value: text.slice(1).toLowerCase(),
    });
    pos = mark.end;
  }
  if (pos < caption.length) {
    segments.push({ type: 'text', text: caption.slice(pos) });
  }
  return segments;
}

export function countTokens(caption: string) {
  const segments = parseCaption(caption);
  const unique = (type: 'hashtag' | 'mention') =>
    new Set(segments.flatMap(s => (s.type === type ? [s.value] : []))).size;
  return { hashtags: unique('hashtag'), mentions: unique('mention') };
}

export type ActiveToken = {
  trigger: '#' | '@';
  query: string;
  /** Index of the trigger character. */
  start: number;
  /** Index just after the token. */
  end: number;
};

/** The `#tag` or `@name` the cursor is in, for autocomplete. */
export function activeToken(text: string, cursor: number): ActiveToken | null {
  const before = text.slice(0, cursor);
  const match = new RegExp(
    `(^|[\\s([{])([#@])([${TAG_CHARS}.]{0,100})$`,
    'u',
  ).exec(before);
  if (!match) return null;
  const trigger = match[2] as '#' | '@';
  const query = match[3]!;
  if (trigger === '@' && !/^[a-z0-9._]*$/i.test(query)) return null;
  if (trigger === '#' && query.includes('.')) return null;
  const start = cursor - query.length - 1;
  const rest = /^[\p{L}\p{M}\p{N}_.]*/u.exec(text.slice(cursor))![0];
  return { trigger, query, start, end: cursor + rest.length };
}

/** Replaces the active token with the chosen suggestion and a trailing space. */
export function applySuggestion(
  text: string,
  token: ActiveToken,
  value: string,
) {
  const insert = `${token.trigger}${value} `;
  const after = text.slice(token.end).replace(/^ /, '');
  const next = text.slice(0, token.start) + insert + after;
  return { text: next, cursor: token.start + insert.length };
}
