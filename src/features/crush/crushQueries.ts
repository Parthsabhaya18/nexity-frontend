import { skipToken, useQuery } from '@tanstack/react-query';

import { queryClient } from '@/features/entities/entityCache';
import { secretCrushApi } from '@/services/api/secretCrush';

/** Under `['secret']`, so `refreshSecret()` and plan changes refresh crushes too. */
export const crushKeys = {
  all: ['secret', 'crush'] as const,
  summary: ['secret', 'crush', 'summary'] as const,
  list: ['secret', 'crush', 'list'] as const,
  matches: ['secret', 'crush', 'matches'] as const,
  match: (id: string) => ['secret', 'crush', 'match', id] as const,
  status: (userId: string) => ['secret', 'crush', 'status', userId] as const,
};

export const useCrushSummary = () =>
  useQuery({ queryKey: crushKeys.summary, queryFn: secretCrushApi.summary });

export const useCrushList = () =>
  useQuery({ queryKey: crushKeys.list, queryFn: secretCrushApi.list });

export const useCrushMatches = () =>
  useQuery({ queryKey: crushKeys.matches, queryFn: secretCrushApi.matches });

export const useCrushMatch = (id: string) =>
  useQuery({
    queryKey: crushKeys.match(id),
    queryFn: () => secretCrushApi.match(id),
    retry: false,
  });

export const useCrushStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: crushKeys.status(userId ?? ''),
    queryFn: userId ? () => secretCrushApi.status(userId) : skipToken,
  });

export function refreshCrush() {
  return queryClient.invalidateQueries({ queryKey: crushKeys.all });
}
