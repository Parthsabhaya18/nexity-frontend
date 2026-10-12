import { useEffect, useState } from 'react';

const listeners = new Set<() => void>();

export function emitStoryShared() {
  listeners.forEach(listener => listener());
}

export function onStoryShared(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Your own stories watched this session, so every ring updates before the tray reloads. */
const ownSeen = new Set<string>();
const ownSeenListeners = new Set<() => void>();

export function markOwnStorySeen(id: string) {
  if (ownSeen.has(id)) return;
  ownSeen.add(id);
  ownSeenListeners.forEach(listener => listener());
}

/** True once every one of your own stories in the list has been watched. */
export function ownStoriesSeen(stories: readonly { id: string }[]) {
  return stories.every(s => ownSeen.has(s.id));
}

/** Re-renders the caller whenever one of your own stories is watched. */
export function useOwnStoriesSeen() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    ownSeenListeners.add(listener);
    return () => {
      ownSeenListeners.delete(listener);
    };
  }, []);
  return ownStoriesSeen;
}
