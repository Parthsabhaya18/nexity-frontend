import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/api/client';
import type { Page } from '@/services/api/follows';

type Fetcher<T> = (
  cursor: string | null,
  signal: AbortSignal,
) => Promise<Page<T>>;

/**
 * Cursor list with first load, pull-to-refresh and infinite scroll. Reloads
 * whenever `fetchPage` changes (memoise it on its inputs, e.g. the search
 * text); older in-flight requests are cancelled so results never mix.
 */
export function usePagedList<T>(
  fetchPage: Fetcher<T>,
  { onPage }: { onPage?: (items: T[]) => void } = {},
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const page = await fetchPage(null, c.signal);
        if (c.signal.aborted) return;
        onPageRef.current?.(page.items);
        setItems(page.items);
        setCursor(page.next_cursor);
      } catch (err) {
        if (c.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('Something went wrong. Please try again.'),
        );
      } finally {
        if (!c.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    load('initial');
    return () => controller.current?.abort();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading || refreshing) return;
    const c = controller.current;
    if (!c) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor, c.signal);
      if (c.signal.aborted) return;
      onPageRef.current?.(page.items);
      setItems(prev => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      // The next scroll to the end retries.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, loading, refreshing, fetchPage]);

  return {
    items,
    setItems,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: !!cursor,
    refresh: () => load('refresh'),
    retry: () => load('initial'),
    loadMore,
  };
}
