import { useEffect, useState } from 'react';

import { primeFollowStatuses } from '@/features/follows/followStore';
import { followsApi, type UserSummary } from '@/services/api/follows';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

import { MENTION_SUGGESTIONS, type ActiveToken } from './caption';

/**
 * Up to five people for the `@name` being typed. Just `@` lists people the
 * user follows; typing narrows it to names starting with the text. Blocked
 * accounts are never returned. Stale requests are cancelled.
 */
export function useMentionSuggestions(token: ActiveToken | null) {
  const active = !!token;
  const query = useDebouncedValue(token?.query ?? '', 150);
  const [result, setResult] = useState<UserSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) {
      setResult(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    followsApi
      .mentionUsers(query, MENTION_SUGGESTIONS, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return;
        primeFollowStatuses(items);
        setResult(items.slice(0, MENTION_SUGGESTIONS));
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, query]);

  return { active, loading, users: active ? result : null };
}
