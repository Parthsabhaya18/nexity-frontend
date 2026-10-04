import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/services/api/client';
import { type FollowStatus, followsApi } from '@/services/api/follows';

import { setFollowStatus, useFollowStatus } from './followStore';

type Target = { id: string; username: string; is_private: boolean };

/** Optimistic follow / unfollow / cancel-request; reverts and explains on failure. */
export function useFollowAction(target: Target, serverStatus: FollowStatus) {
  const { refreshUser } = useAuth();
  const status = useFollowStatus(target.id, serverStatus);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (
      optimistic: FollowStatus,
      call: () => Promise<FollowStatus>,
      previous: FollowStatus,
    ) => {
      setFollowStatus(target.id, optimistic);
      setBusy(true);
      try {
        setFollowStatus(target.id, await call());
        refreshUser().catch(() => {});
      } catch (err) {
        setFollowStatus(target.id, previous);
        Alert.alert(
          "Couldn't update",
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        setBusy(false);
      }
    },
    [target.id, refreshUser],
  );

  const follow = useCallback(
    () =>
      run(
        target.is_private ? 'pending' : 'accepted',
        async () => (await followsApi.follow(target.id)).status,
        status,
      ),
    [run, target.id, target.is_private, status],
  );

  const unfollowNow = useCallback(
    () =>
      run(
        'none',
        async () => {
          await followsApi.unfollow(target.id);
          return 'none';
        },
        status,
      ),
    [run, target.id, status],
  );

  /** Private accounts ask first, because following again needs a new request. */
  const unfollow = useCallback(() => {
    if (!target.is_private) {
      unfollowNow();
      return;
    }
    Alert.alert(
      `Unfollow @${target.username}?`,
      "Their account is private, so you'll need to send a new request to see their posts.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfollow', style: 'destructive', onPress: unfollowNow },
      ],
    );
  }, [target.is_private, target.username, unfollowNow]);

  return { status, busy, follow, unfollow, cancelRequest: unfollowNow };
}
