import {
  canMessage,
  getEngagement,
  getRelation,
  primeUsers,
  queryClient,
  setRelation,
} from '@/features/entities/entityCache';
import {
  cancelFollowRequest,
  followUser,
  setMuted,
  toggleSave,
  unfollowUser,
} from '@/features/entities/entityActions';
import { runOptimistic } from '@/features/entities/optimistic';
import { emitPostEvent, onPostEvent } from '@/features/posts/postEvents';
import { followsApi } from '@/services/api/follows';
import { postsApi } from '@/services/api/posts';
import { safetyApi } from '@/services/api/safety';
import { showToast } from '@/components/ui/Toast';

jest.mock('@/components/ui/Toast', () => ({ showToast: jest.fn() }));
jest.mock('@/services/api/follows', () => ({
  followsApi: { follow: jest.fn(), unfollow: jest.fn() },
}));
jest.mock('@/services/api/safety', () => ({
  safetyApi: { block: jest.fn(), unblock: jest.fn(), mute: jest.fn(), unmute: jest.fn() },
}));
jest.mock('@/services/api/posts', () => ({
  postsApi: { save: jest.fn(), setLiked: jest.fn() },
}));
jest.mock('@/services/api/reels', () => ({ reelsApi: { setLiked: jest.fn() } }));
jest.mock('@/services/api/stories', () => ({ storiesApi: { setLiked: jest.fn() } }));

const follows = followsApi as jest.Mocked<typeof followsApi>;
const safety = safetyApi as jest.Mocked<typeof safetyApi>;
const posts = postsApi as jest.Mocked<typeof postsApi>;
const toast = showToast as jest.Mock;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe('relationship cache', () => {
  it('primes from server payloads and merges later patches', () => {
    primeUsers([{ id: 'u1', follow_status: 'pending', is_private: true }]);
    expect(getRelation('u1')).toEqual({
      relationship: 'requested',
      follows_you: false,
      is_private: true,
      muted: false,
    });
    setRelation('u1', { follows_you: true });
    expect(getRelation('u1')).toMatchObject({ relationship: 'requested', follows_you: true });
  });

  it('allows messaging for public accounts or when either follows the other, never when blocked', () => {
    const base = { relationship: 'none', follows_you: false, is_private: true, muted: false } as const;
    expect(canMessage(undefined)).toBe(false);
    expect(canMessage({ ...base })).toBe(false);
    expect(canMessage({ ...base, is_private: false })).toBe(true);
    expect(canMessage({ ...base, relationship: 'following' })).toBe(true);
    expect(canMessage({ ...base, follows_you: true })).toBe(true);
    expect(canMessage({ ...base, relationship: 'requested' })).toBe(false);
    expect(canMessage({ ...base, is_private: false, relationship: 'blocked_by_me' })).toBe(false);
    expect(canMessage({ ...base, is_private: false, relationship: 'blocked_me' })).toBe(false);
  });
});

describe('optimistic relation actions', () => {
  it('shows Following at once and keeps the server answer', async () => {
    const call = deferred<{ status: 'accepted' }>();
    follows.follow.mockReturnValueOnce(call.promise);
    const done = followUser({ id: 'u1', is_private: false });
    expect(getRelation('u1')?.relationship).toBe('following');
    call.resolve({ status: 'accepted' });
    await expect(done).resolves.toEqual({ ok: true, result: { status: 'accepted' } });
    expect(getRelation('u1')?.relationship).toBe('following');
  });

  it('private accounts become Requested; cancelling reverts to none', async () => {
    follows.follow.mockResolvedValueOnce({ status: 'pending' });
    await followUser({ id: 'u2', is_private: true });
    expect(getRelation('u2')?.relationship).toBe('requested');
    follows.unfollow.mockResolvedValueOnce(undefined);
    await cancelFollowRequest('u2');
    expect(getRelation('u2')?.relationship).toBe('none');
  });

  it('rolls back and shows an error toast when the request fails', async () => {
    setRelation('u3', { relationship: 'following', is_private: true });
    follows.unfollow.mockRejectedValueOnce(new Error('offline'));
    const result = await unfollowUser('u3');
    expect(result).toEqual({ ok: false });
    expect(getRelation('u3')?.relationship).toBe('following');
    expect(toast).toHaveBeenCalledWith("Couldn't unfollow. Please try again.", 'error');
  });

  it('an old failure never undoes a newer change', async () => {
    const first = deferred<void>();
    safety.mute.mockReturnValueOnce(first.promise);
    safety.unmute.mockResolvedValueOnce(undefined);
    const muting = setMuted('u4', true);
    await setMuted('u4', false);
    first.reject(new Error('late failure'));
    await muting;
    expect(getRelation('u4')?.muted).toBe(false);
  });

  it('removes a relation that did not exist before a failed change', async () => {
    follows.follow.mockRejectedValueOnce(new Error('offline'));
    await followUser({ id: 'u5', is_private: false });
    expect(getRelation('u5')).toBeUndefined();
  });
});

describe('engagement sync', () => {
  it('post events write the cache so every screen sees one value', () => {
    const seen: unknown[] = [];
    const off = onPostEvent(e => seen.push(e));
    emitPostEvent({ type: 'patch', kind: 'post', id: 'p1', patch: { liked_by_me: true, likes_count: 4 } });
    expect(getEngagement('post', 'p1')).toMatchObject({ liked_by_me: true, likes_count: 4 });
    expect(seen).toHaveLength(1);
    emitPostEvent({ type: 'remove', kind: 'post', id: 'p1' });
    expect(getEngagement('post', 'p1')).toBeUndefined();
    off();
  });

  it('save toggles optimistically and reverts on failure', async () => {
    posts.save.mockRejectedValueOnce(new Error('offline'));
    const pending = toggleSave('p2', { saved_by_me: false });
    expect(getEngagement('post', 'p2')?.saved_by_me).toBe(true);
    await pending;
    expect(getEngagement('post', 'p2')?.saved_by_me).toBe(false);
    expect(toast).toHaveBeenCalledWith("Couldn't update saved. Please try again.", 'error');
  });

  it('runOptimistic commits only the latest change', async () => {
    const commit = jest.fn();
    const slow = deferred<number>();
    const a = runOptimistic({ key: 'k', apply: () => () => {}, run: () => slow.promise, commit });
    const b = runOptimistic({ key: 'k', apply: () => () => {}, run: async () => 2, commit });
    await b;
    slow.resolve(1);
    await a;
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);
  });
});
