import { useMemo } from 'react';

import { useToast as useAppToast } from '@/components/ui/Toast';

/** Chat screens' toast API on top of the app-wide `ToastHost`; `toast` renders nothing. */
export function useToast() {
  const { show } = useAppToast();
  return useMemo(
    () => ({ toast: null, show: (text: string) => show(text) }),
    [show],
  );
}
