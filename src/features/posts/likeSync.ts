import { showToast } from '@/components/ui/Toast';
import { errorText } from '@/features/entities/optimistic';
import { postsApi } from '@/services/api/posts';
import { reelsApi } from '@/services/api/reels';

import { emitPostEvent } from './postEvents';

type Kind = 'post' | 'reel';

export interface LikeState {
  liked_by_me: boolean;
  /** Null while the owner hides the count. */
  likes_count: number | null;
}

type Entry = {
  /** What the user wants right now. */
  wanted: boolean;
  /** Last state the server confirmed (or what we started from). */
  confirmed: LikeState;
  running: boolean;
};

const entries = new Map<string, Entry>();

const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;

const withCount = (state: LikeState, liked: boolean): LikeState => ({
  liked_by_me: liked,
  likes_count:
    state.likes_count === null
      ? null
      : Math.max(0, state.likes_count + (liked ? 1 : 0) - (state.liked_by_me ? 1 : 0)),
});

async function pump(kind: Kind, id: string, entry: Entry) {
  entry.running = true;
  const key = keyOf(kind, id);
  try {
    // Keep sending until the server matches what the user last asked for.
    while (entry.wanted !== entry.confirmed.liked_by_me) {
      const sending = entry.wanted;
      const result =
        kind === 'post'
          ? (await postsApi.setLiked(id, sending)).post
          : await reelsApi.setLiked(id, sending);
      entry.confirmed = {
        liked_by_me: result.liked_by_me,
        likes_count: result.likes_count,
      };
      // Only show the server count when nothing newer is waiting.
      if (entry.wanted === sending) {
        emitPostEvent({
          type: 'patch',
          kind,
          id,
          patch: { ...entry.confirmed },
        });
      }
    }
  } catch (err) {
    // Put the heart back where the server has it.
    entry.wanted = entry.confirmed.liked_by_me;
    emitPostEvent({ type: 'patch', kind, id, patch: { ...entry.confirmed } });
    showToast(errorText(err, "Couldn't update the like. Please try again."), 'error');
  } finally {
    entry.running = false;
    if (entry.wanted === entry.confirmed.liked_by_me) entries.delete(key);
  }
}

/**
 * Likes or unlikes right away on every screen, then syncs with the server.
 * Taps made while a request is in flight are collapsed into the final state,
 * so quick taps never race or double count.
 */
export function setLikeState(
  kind: Kind,
  id: string,
  current: LikeState,
  liked: boolean,
) {
  const key = keyOf(kind, id);
  let entry = entries.get(key);
  if (!entry) {
    entry = { wanted: current.liked_by_me, confirmed: current, running: false };
    entries.set(key, entry);
  }
  entry.wanted = liked;
  emitPostEvent({
    type: 'patch',
    kind,
    id,
    patch: withCount(entry.confirmed, liked),
  });
  if (!entry.running) pump(kind, id, entry);
}
