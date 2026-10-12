import { skipToken, useQuery } from '@tanstack/react-query';

import { queryClient } from '@/features/entities/entityCache';
import { nearbyApi } from '@/services/api/nearby';
import { secretMessagesApi } from '@/services/api/secretMessages';
import { type Subscription, subscriptionsApi } from '@/services/api/subscriptions';

export const secretKeys = {
  all: ['secret'] as const,
  summary: ['secret', 'summary'] as const,
  inbox: ['secret', 'inbox'] as const,
  sent: ['secret', 'sent'] as const,
  thread: (id: string) => ['secret', 'thread', id] as const,
  messages: (id: string) => ['secret', 'messages', id] as const,
  blocks: ['secret', 'blocks'] as const,
  subscription: ['subscription'] as const,
  plans: ['plans'] as const,
  nearby: ['nearby', 'settings'] as const,
  nearbyUsers: ['nearby', 'users'] as const,
};

export const useSubscription = () =>
  useQuery({ queryKey: secretKeys.subscription, queryFn: subscriptionsApi.me });

export const usePlans = () =>
  useQuery({
    queryKey: secretKeys.plans,
    queryFn: subscriptionsApi.plans,
    staleTime: 10 * 60_000,
  });

export const useSecretSummary = () =>
  useQuery({ queryKey: secretKeys.summary, queryFn: secretMessagesApi.summary });

export const useSecretInbox = (enabled: boolean) =>
  useQuery({
    queryKey: secretKeys.inbox,
    queryFn: enabled ? () => secretMessagesApi.inbox() : skipToken,
  });

export const useSecretSent = () =>
  useQuery({
    queryKey: secretKeys.sent,
    queryFn: () => secretMessagesApi.sent(),
  });

export const useSecretThread = (id: string) =>
  useQuery({
    queryKey: secretKeys.thread(id),
    queryFn: () => secretMessagesApi.thread(id),
    retry: false,
  });

export const useSecretMessages = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: secretKeys.messages(id),
    queryFn: enabled ? () => secretMessagesApi.messages(id) : skipToken,
    retry: false,
  });

export const useNearbySettings = (enabled = true) =>
  useQuery({
    queryKey: secretKeys.nearby,
    queryFn: enabled ? nearbyApi.settings : skipToken,
  });

export const useNearbyPeople = (enabled: boolean) =>
  useQuery({
    queryKey: secretKeys.nearbyUsers,
    queryFn: enabled ? nearbyApi.nearbyUsers : skipToken,
    refetchInterval: enabled ? 8000 : false,
    staleTime: 0,
  });

export function refreshSecret() {
  return queryClient.invalidateQueries({ queryKey: secretKeys.all });
}

/** A plan change unlocks or locks Secret Messages and Nearby hints everywhere. */
export function applySubscription(sub: Subscription) {
  queryClient.setQueryData(secretKeys.subscription, sub);
  refreshSecret().catch(() => {});
}

export const hasPlan = (sub: Subscription | undefined) =>
  !!sub && sub.plan !== 'free';
