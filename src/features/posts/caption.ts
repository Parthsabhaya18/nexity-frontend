/** Instagram's limits; the API enforces the same. */
export const CAPTION_MAX = 2200;
export const MAX_MENTIONS = 20;
/** People that can be tagged on one post. */
export const MAX_TAGGED = 20;
/** Most people shown when typing `@`. */
export const MENTION_SUGGESTIONS = 5;
export const ALT_TEXT_MAX = 100;
export const LOCATION_MAX = 100;

const NAME_CHARS = 'a-z0-9._';
/** Only at the start, after a space or an opening bracket, so "…@ann" or "hi@ann" stays text. */
const MENTION_RE = /(^|[\s([{])@([a-z0-9._]{1,30})/gi;

export type CaptionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; value: string };

/** Splits a caption into plain text and `@mentions` for highlighting. */
export function parseCaption(caption: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let pos = 0;
  for (const m of caption.matchAll(MENTION_RE)) {
    const name = m[2]!.replace(/\.+$/, '');
    if (name.length < 3) continue;
    const start = m.index! + m[1]!.length;
    if (start < pos) continue;
    if (start > pos) {
      segments.push({ type: 'text', text: caption.slice(pos, start) });
    }
    const end = start + 1 + name.length;
    segments.push({
      type: 'mention',
      text: caption.slice(start, end),
      value: name.toLowerCase(),
    });
    pos = end;
  }
  if (pos < caption.length) {
    segments.push({ type: 'text', text: caption.slice(pos) });
  }
  return segments;
}

export function countMentions(caption: string) {
  return new Set(
    parseCaption(caption).flatMap(s => (s.type === 'mention' ? [s.value] : [])),
  ).size;
}

export type ActiveToken = {
  /** Text typed after the `@`. */
  query: string;
  /** Index of the `@`. */
  start: number;
  /** Index just after the token. */
  end: number;
};

/** The `@name` the cursor is in, for autocomplete. */
export function activeToken(text: string, cursor: number): ActiveToken | null {
  const before = text.slice(0, cursor);
  const match = new RegExp(`(^|[\\s([{])@([${NAME_CHARS}]{0,30})$`, 'i').exec(
    before,
  );
  if (!match) return null;
  const query = match[2]!;
  const start = cursor - query.length - 1;
  const rest = new RegExp(`^[${NAME_CHARS}]*`, 'i').exec(text.slice(cursor))![0];
  return { query, start, end: cursor + rest.length };
}

/** Replaces the active token with the chosen username and a trailing space. */
export function applySuggestion(
  text: string,
  token: ActiveToken,
  username: string,
) {
  const insert = `@${username} `;
  const after = text.slice(token.end).replace(/^ /, '');
  const next = text.slice(0, token.start) + insert + after;
  return { text: next, cursor: token.start + insert.length };
}
