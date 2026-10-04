import { useRef } from 'react';

/**
 * One submit at a time. Presses that land while a request is still running
 * are ignored, so the screen does not start a second call.
 */
export function useSubmitLock() {
  const busy = useRef(false);

  return (task: () => void | Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    void Promise.resolve(task()).finally(() => {
      busy.current = false;
    });
  };
}
