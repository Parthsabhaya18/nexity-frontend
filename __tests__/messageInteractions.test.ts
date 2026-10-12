import {
  EMOJI_CATEGORIES,
  searchEmojis,
} from '../src/components/chat/emojiData';
import {
  buildPickerRows,
  placeInSlot,
} from '../src/components/chat/EmojiPickerSheet';
import {
  estimateQuoteLines,
  QUOTE_MAX_LINES,
  quoteTextWidth,
  reactionSummary,
} from '../src/components/chat/MessageBubble';
import {
  layoutOverlay,
  OVERLAY_GAP,
  OVERLAY_MARGIN,
} from '../src/components/chat/overlayLayout';
import { reactionRows } from '../src/components/chat/ReactionDetailsSheet';
import {
  canEdit,
  type ChatMessage,
  EDIT_WINDOW_MS,
  myReaction,
  toggleReaction,
} from '../src/features/chats/chatStore';
import type { ReactionGroup } from '../src/services/api/chat';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const mockPrefs: Record<string, string> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
  setGenericPassword: jest.fn(async (_u: string, value: string, o: { service: string }) => {
    mockPrefs[o.service] = value;
    return true;
  }),
  getGenericPassword: jest.fn(async (o: { service: string }) =>
    mockPrefs[o.service] ? { password: mockPrefs[o.service] } : false,
  ),
  resetGenericPassword: jest.fn(async () => true),
}));

const ME = 'me';
const A = 'a';
const B = 'b';

describe('toggleReaction', () => {
  it('adds a new emoji group at the end', () => {
    const groups: ReactionGroup[] = [{ emoji: '❤️', user_ids: [A], count: 1 }];
    expect(toggleReaction(groups, ME, '😂')).toEqual([
      { emoji: '❤️', user_ids: [A], count: 1 },
      { emoji: '😂', user_ids: [ME], count: 1 },
    ]);
  });

  it('joins an existing group', () => {
    const groups: ReactionGroup[] = [{ emoji: '😂', user_ids: [A, B], count: 2 }];
    expect(toggleReaction(groups, ME, '😂')).toEqual([
      { emoji: '😂', user_ids: [A, B, ME], count: 3 },
    ]);
  });

  it('removes my reaction when I tap the same emoji', () => {
    const groups: ReactionGroup[] = [
      { emoji: '😂', user_ids: [A, ME], count: 2 },
      { emoji: '👍', user_ids: [B], count: 1 },
    ];
    expect(toggleReaction(groups, ME, '😂')).toEqual([
      { emoji: '😂', user_ids: [A], count: 1 },
      { emoji: '👍', user_ids: [B], count: 1 },
    ]);
  });

  it('replaces my reaction with a different one and drops empty groups', () => {
    const groups: ReactionGroup[] = [
      { emoji: '❤️', user_ids: [ME], count: 1 },
      { emoji: '👍', user_ids: [A], count: 1 },
    ];
    const next = toggleReaction(groups, ME, '👍');
    expect(next).toEqual([{ emoji: '👍', user_ids: [A, ME], count: 2 }]);
    expect(myReaction(next, ME)).toBe('👍');
  });

  it('never gives one person two reactions', () => {
    let groups: ReactionGroup[] = [];
    for (const e of ['❤️', '😂', '😮', '😂', '👍']) groups = toggleReaction(groups, ME, e);
    const mine = groups.filter(g => g.user_ids.includes(ME));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.emoji).toBe('👍');
  });

  it('works without any reactions yet', () => {
    expect(toggleReaction(undefined, ME, '🔥')).toEqual([
      { emoji: '🔥', user_ids: [ME], count: 1 },
    ]);
    expect(myReaction(undefined, ME)).toBeNull();
    expect(myReaction([{ emoji: '🔥', user_ids: [ME], count: 1 }], null)).toBeNull();
  });
});

describe('reactionSummary', () => {
  it('shows the most popular emojis first, at most three, with the total', () => {
    const summary = reactionSummary([
      { emoji: '👍', user_ids: [A], count: 1 },
      { emoji: '😂', user_ids: [B, ME, 'c'], count: 3 },
      { emoji: '❤️', user_ids: ['d', 'e'], count: 2 },
      { emoji: '😮', user_ids: ['f'], count: 1 },
    ]);
    expect(summary).toEqual({ emojis: ['😂', '❤️', '👍'], total: 7 });
  });

  it('is empty without reactions', () => {
    expect(reactionSummary(undefined)).toEqual({ emojis: [], total: 0 });
  });
});

describe('quote "See more" estimate', () => {
  const width = quoteTextWidth(390);

  it('keeps short quotes as they are', () => {
    expect(estimateQuoteLines('Hello', width)).toBe(1);
  });

  it('flags long quotes from the first paint', () => {
    expect(estimateQuoteLines('word '.repeat(60), width)).toBeGreaterThan(QUOTE_MAX_LINES);
  });

  it('counts blank lines and line breaks', () => {
    const pasted = 'Console Error\n\nReact has detected a change in the order of Hooks';
    expect(estimateQuoteLines(pasted, width)).toBeGreaterThan(QUOTE_MAX_LINES);
  });
});

describe('canEdit', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z');
  const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'm'.repeat(24),
    conversation_id: 'c',
    sender_id: ME,
    type: 'text',
    body: 'hi',
    media: null,
    reply_to_id: null,
    reply_to: null,
    client_message_id: 'x',
    is_deleted: false,
    created_at: new Date(now - 60_000).toISOString(),
    status: 'sent',
    ...over,
  });

  it('allows my own sent text within 15 minutes', () => {
    expect(canEdit(msg(), ME, now)).toBe(true);
  });

  it.each([
    ['someone else’s message', { sender_id: A }],
    ['a GIF', { type: 'gif' as const }],
    ['a pending message', { status: 'sending' as const }],
    ['an unsent message', { is_deleted: true }],
    ['an old message', { created_at: new Date(now - EDIT_WINDOW_MS - 1).toISOString() }],
  ])('refuses %s', (_, over) => {
    expect(canEdit(msg(over), ME, now)).toBe(false);
  });
});

describe('layoutOverlay', () => {
  const screen = { width: 390, height: 844 };
  const insets = { top: 47, bottom: 34 };
  const bar = { width: 300, height: 52 };
  const menu = { width: 236, height: 300 };

  it('puts the bar above and the menu below a message in the middle', () => {
    const bubble = { x: 200, y: 400, width: 170, height: 44 };
    const l = layoutOverlay({ bubble, screen, insets, bar, menu, mine: true });
    expect(l.bubbleTop).toBe(400);
    expect(l.barTop).toBe(400 - OVERLAY_GAP - bar.height);
    expect(l.menuTop).toBe(400 + 44 + OVERLAY_GAP);
    // Right-aligned with my bubble.
    expect(l.menuLeft).toBe(200 + 170 - menu.width);
  });

  it('pushes the stack down for a message at the very top', () => {
    const bubble = { x: 40, y: 60, width: 120, height: 44 };
    const l = layoutOverlay({ bubble, screen, insets, bar, menu, mine: false });
    expect(l.barTop).toBe(insets.top + OVERLAY_MARGIN);
    expect(l.bubbleTop).toBeGreaterThan(bubble.y);
    expect(l.barLeft).toBe(40);
  });

  it('pulls the stack up for a message near the bottom', () => {
    const bubble = { x: 40, y: 760, width: 120, height: 44 };
    const l = layoutOverlay({ bubble, screen, insets, bar, menu, mine: false });
    expect(l.menuTop + menu.height).toBeLessThanOrEqual(
      screen.height - insets.bottom - OVERLAY_MARGIN,
    );
    expect(l.bubbleTop).toBeLessThan(bubble.y);
  });

  it('clips a bubble that is taller than the free space', () => {
    const bubble = { x: 40, y: 100, width: 280, height: 900 };
    const l = layoutOverlay({ bubble, screen, insets, bar, menu, mine: false });
    expect(l.bubbleHeight).toBeLessThan(900);
    expect(l.barTop).toBeGreaterThanOrEqual(insets.top + OVERLAY_MARGIN);
    expect(l.menuTop + menu.height).toBeLessThanOrEqual(
      screen.height - insets.bottom - OVERLAY_MARGIN,
    );
  });

  it('keeps the bar and menu inside the screen horizontally', () => {
    const bubble = { x: 4, y: 400, width: 60, height: 40 };
    const mine = layoutOverlay({ bubble, screen, insets, bar, menu, mine: true });
    expect(mine.barLeft).toBe(OVERLAY_MARGIN);
    const wide = layoutOverlay({
      bubble: { x: 380, y: 400, width: 60, height: 40 },
      screen,
      insets,
      bar,
      menu,
      mine: false,
    });
    expect(wide.barLeft + bar.width).toBeLessThanOrEqual(screen.width - OVERLAY_MARGIN);
    expect(wide.menuLeft + menu.width).toBeLessThanOrEqual(screen.width - OVERLAY_MARGIN);
  });

  it('works in landscape', () => {
    const l = layoutOverlay({
      bubble: { x: 300, y: 150, width: 200, height: 40 },
      screen: { width: 844, height: 390 },
      insets: { top: 0, bottom: 21 },
      bar,
      menu: { width: 236, height: 250 },
      mine: false,
    });
    expect(l.barTop).toBeGreaterThanOrEqual(OVERLAY_MARGIN);
    expect(l.bubbleHeight).toBeGreaterThanOrEqual(0);
  });
});

describe('emoji data and search', () => {
  it('has every Instagram category with emojis and no duplicates inside one', () => {
    expect(EMOJI_CATEGORIES.map(c => c.key)).toEqual([
      'smileys',
      'animals',
      'food',
      'activities',
      'travel',
      'objects',
      'symbols',
      'flags',
    ]);
    EMOJI_CATEGORIES.forEach(c => {
      expect(c.emojis.length).toBeGreaterThan(40);
      expect(new Set(c.emojis.map(e => e.emoji)).size).toBe(c.emojis.length);
    });
  });

  it('finds emojis by keyword prefix', () => {
    expect(searchEmojis('hea')).toEqual(expect.arrayContaining(['❤️', '😍']));
    expect(searchEmojis('india')).toEqual(['🇮🇳']);
    expect(searchEmojis('  PIZZA ')).toEqual(['🍕']);
    expect(searchEmojis('')).toEqual([]);
    expect(searchEmojis('zzzqqq')).toEqual([]);
  });
});

describe('picker rows', () => {
  const quick = ['❤️', '😂', '😮', '😢', '😡', '👍'];

  it('lists your reactions, recents, then categories in rows of 8', () => {
    const rows = buildPickerRows({ query: '', quick, recent: ['🔥'], includeQuick: true });
    const headers = rows.filter(r => r.kind === 'header').map(r => r.section);
    expect(headers.slice(0, 3)).toEqual(['yours', 'recent', 'smileys']);
    rows.forEach(r => {
      if (r.kind === 'emojis') expect(r.emojis.length).toBeLessThanOrEqual(8);
    });
  });

  it('hides empty recents and your reactions while customizing', () => {
    const rows = buildPickerRows({ query: '', quick, recent: [], includeQuick: false });
    expect(rows[0]).toMatchObject({ kind: 'header', section: 'smileys' });
  });

  it('shows only results while searching', () => {
    const rows = buildPickerRows({ query: 'pizza', quick, recent: [], includeQuick: true });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: 'emojis', emojis: ['🍕'] });
  });
});

describe('customizing quick reactions', () => {
  it('puts the emoji in the chosen slot', () => {
    expect(placeInSlot(['❤️', '😂', '😮'], 1, '🔥')).toEqual(['❤️', '🔥', '😮']);
  });

  it('swaps instead of duplicating', () => {
    expect(placeInSlot(['❤️', '😂', '😮'], 0, '😮')).toEqual(['😮', '😂', '❤️']);
  });
});

describe('reaction details', () => {
  it('lists me first, then everyone else, optionally filtered by emoji', () => {
    const groups: ReactionGroup[] = [
      { emoji: '😂', user_ids: [A, ME], count: 2 },
      { emoji: '❤️', user_ids: [B], count: 1 },
    ];
    expect(reactionRows(groups, ME)).toEqual([
      { userId: ME, emoji: '😂' },
      { userId: A, emoji: '😂' },
      { userId: B, emoji: '❤️' },
    ]);
    expect(reactionRows(groups, ME, '❤️')).toEqual([{ userId: B, emoji: '❤️' }]);
  });
});

describe('reaction preferences', () => {
  it('saves quick reactions and recents, and restores them on the next launch', async () => {
    let prefs!: typeof import('../src/features/chats/reactionPrefs');
    jest.isolateModules(() => {
      prefs = require('../src/features/chats/reactionPrefs');
    });
    prefs.reactionPrefs.setQuick(['🔥', '😂', '😮', '😢', '😡', '👍']);
    prefs.reactionPrefs.pushRecent('🦄');
    prefs.reactionPrefs.pushRecent('🍕');
    prefs.reactionPrefs.pushRecent('🦄');
    prefs.reactionPrefs.setQuick(['too', 'short']);
    expect(prefs.reactionPrefs.get().recent).toEqual(['🦄', '🍕']);
    await new Promise<void>(r => setImmediate(r));

    let fresh!: typeof import('../src/features/chats/reactionPrefs');
    jest.isolateModules(() => {
      fresh = require('../src/features/chats/reactionPrefs');
    });
    expect(fresh.reactionPrefs.get().quick).toEqual(fresh.DEFAULT_REACTIONS);
    await fresh.loadReactionPrefs();
    expect(fresh.reactionPrefs.get().quick[0]).toBe('🔥');
    expect(fresh.reactionPrefs.get().recent).toEqual(['🦄', '🍕']);

    fresh.reactionPrefs.resetQuick();
    expect(fresh.reactionPrefs.get().quick).toEqual(fresh.DEFAULT_REACTIONS);
  });
});
