import { useSyncExternalStore } from 'react';

import { secureStore } from '@/services/storage/secureStore';

export const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;
export const QUICK_REACTION_COUNT = DEFAULT_REACTIONS.length;
const RECENT_MAX = 24;

type Prefs = { quick: readonly string[]; recent: readonly string[] };

let state: Prefs = { quick: DEFAULT_REACTIONS, recent: [] };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function update(next: Prefs) {
  state = next;
  listeners.forEach(l => l());
}

/** Reads saved reactions once; safe to call many times. */
export function loadReactionPrefs() {
  loaded ??= (async () => {
    const [quick, recent] = await Promise.all([
      secureStore.getPreference<string[]>('quickReactions'),
      secureStore.getPreference<string[]>('recentEmojis'),
    ]);
    update({
      quick:
        Array.isArray(quick) && quick.length === QUICK_REACTION_COUNT
          ? quick
          : state.quick,
      recent: Array.isArray(recent) ? recent.slice(0, RECENT_MAX) : state.recent,
    });
  })().catch(() => undefined);
  return loaded;
}

export const reactionPrefs = {
  get: () => state,

  setQuick(list: readonly string[]) {
    if (list.length !== QUICK_REACTION_COUNT) return;
    update({ ...state, quick: [...list] });
    secureStore.setPreference('quickReactions', list);
  },

  resetQuick() {
    reactionPrefs.setQuick(DEFAULT_REACTIONS);
  },

  /** Most recent first, no duplicates. */
  pushRecent(emoji: string) {
    const recent = [emoji, ...state.recent.filter(e => e !== emoji)].slice(
      0,
      RECENT_MAX,
    );
    update({ ...state, recent });
    secureStore.setPreference('recentEmojis', recent);
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useReactionPrefs() {
  return useSyncExternalStore(reactionPrefs.subscribe, reactionPrefs.get);
}
