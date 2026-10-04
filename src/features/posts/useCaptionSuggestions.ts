import { useEffect, useState } from 'react';

import { primeFollowStatuses } from '@/features/follows/followStore';
import { followsApi, type UserSummary } from '@/services/api/follows';
import { postsApi, type TagSuggestion } from '@/services/api/posts';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

import type { ActiveToken } from './caption';

export type Suggestions =
  | { type: 'users'; items: UserSummary[] }
  | { type: 'tags'; items: TagSuggestion[] };

/** People for `@`, hashtags for `#`; stale requests are cancelled. */
export function useCaptionSuggestions(token: ActiveToken | null) {
  const key = token?.query ? `${token.trigger}${token.query}` : '';
  const debounced = useDebouncedValue(key, 250);
  const [result, setResult] = useState<{
    key: string;
    data: Suggestions;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debounced) {
      setResult(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const query = debounced.slice(1);
    setLoading(true);
    const request: Promise<Suggestions> = debounced.startsWith('@')
      ? followsApi.searchUsers(query, controller.signal).then(items => {
          primeFollowStatuses(items);
          return { type: 'users' as const, items: items.slice(0, 8) };
        })
      : postsApi
          .searchTags(query, controller.signal)
          .then(items => ({ type: 'tags' as const, items }));
    request
      .then(data => setResult({ key: debounced, data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced]);

  return {
    active: !!key,
    loading: !!key && (loading || debounced !== key),
    suggestions: result && result.key === key ? result.data : null,
  };
}
