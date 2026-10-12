import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` so relative labels ("Active 5m ago") stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
