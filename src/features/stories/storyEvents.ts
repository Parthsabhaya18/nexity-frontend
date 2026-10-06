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
