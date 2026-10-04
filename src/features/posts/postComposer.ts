import { useSyncExternalStore } from 'react';

import {
  discardUploadSession,
  isUploadCancelled,
  uploadErrorMessage,
  uploadMedia,
  type UploadSession,
} from '@/features/media/uploadMedia';
import { ApiError } from '@/services/api/client';
import { mediaApi } from '@/services/api/media';
import { type Post, postsApi } from '@/services/api/posts';

import { bakeCrop } from './bakeCrop';
import { aspectRatioOf, type PostDraft } from './postDraft';
import { clearSavedDraft } from './savedDraft';

export type ShareStatus = 'uploading' | 'sharing' | 'failed' | 'done';

export interface ShareState {
  id: string;
  thumbnailUri: string;
  count: number;
  status: ShareStatus;
  progress: number;
  error?: string;
  post?: Post;
}

type Job = {
  draft: PostDraft;
  clientUploadId: string;
  /** Uploaded media ids by carousel index; kept across retries. */
  mediaIds: (string | undefined)[];
  sessions: UploadSession[];
  fractions: number[];
  controller: AbortController;
};

const CONCURRENCY = 3;
const DONE_VISIBLE_MS = 4000;

let state: ShareState | null = null;
let job: Job | null = null;
let doneTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const sharedListeners = new Set<(post: Post) => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function setState(next: ShareState | null) {
  state = next;
  listeners.forEach(l => l());
}

const patch = (change: Partial<ShareState>) => {
  if (state) setState({ ...state, ...change });
};

const newUploadId = () =>
  `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function run(current: Job) {
  const { draft, controller } = current;
  const signal = controller.signal;
  const reportProgress = () => {
    const total = current.fractions.reduce((a, b) => a + b, 0);
    patch({ progress: (total / current.fractions.length) * 0.95 });
  };

  patch({ status: 'uploading', error: undefined });
  try {
    const queue = draft.items
      .map((_, i) => i)
      .filter(i => !current.mediaIds[i]);
    const worker = async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        const prepared = await bakeCrop(draft.items[i]!);
        const asset = await uploadMedia(prepared, 'post', {
          session: current.sessions[i],
          signal,
          onProgress: f => {
            current.fractions[i] = f;
            reportProgress();
          },
        });
        current.mediaIds[i] = asset.id;
        current.fractions[i] = 1;
        reportProgress();
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );
    if (signal.aborted) return;

    patch({ status: 'sharing', progress: 0.97 });
    const post = await postsApi.create({
      media_ids: current.mediaIds as string[],
      caption: draft.caption.trim(),
      alt_texts: [],
      location_name: draft.location.trim(),
      location_lat: draft.locationLat,
      location_lng: draft.locationLng,
      adjustments: draft.adjustments,
      filters: draft.items.map(item => item.filter || 'normal'),
      music_title: draft.music.trim(),
      aspect_ratio: aspectRatioOf(draft.aspect, draft.items[0]?.media),
      hide_like_count: draft.hideLikeCount,
      comments_disabled: draft.commentsDisabled,
      client_upload_id: current.clientUploadId,
    });
    if (job !== current) return;
    job = null;
    patch({ status: 'done', progress: 1, post });
    clearSavedDraft().catch(() => {});
    sharedListeners.forEach(l => l(post));
    doneTimer = setTimeout(() => {
      if (state?.status === 'done') setState(null);
    }, DONE_VISIBLE_MS);
  } catch (err) {
    if (job !== current || signal.aborted || isUploadCancelled(err)) return;
    // The server refused the uploads (e.g. one expired); upload them again on retry.
    if (err instanceof ApiError && err.code === 'INVALID_MEDIA') {
      current.mediaIds = current.mediaIds.map(() => undefined);
      current.fractions = current.fractions.map(() => 0);
    }
    patch({ status: 'failed', error: uploadErrorMessage(err) });
  }
}

export function isSharing() {
  return !!state && state.status !== 'done';
}

/**
 * Uploads the draft and creates the post in the background, so the user can
 * leave the create flow right away (Instagram's "Posting…" bar).
 */
export function sharePost(draft: PostDraft) {
  if (isSharing()) throw new Error('A post is already being shared.');
  clearTimeout(doneTimer);
  const count = draft.items.length;
  job = {
    draft,
    clientUploadId: newUploadId(),
    mediaIds: new Array(count).fill(undefined),
    sessions: draft.items.map(() => ({})),
    fractions: new Array(count).fill(0),
    controller: new AbortController(),
  };
  setState({
    id: job.clientUploadId,
    thumbnailUri: draft.items[0]!.media.uri,
    count,
    status: 'uploading',
    progress: 0,
  });
  run(job);
}

export function retryShare() {
  if (!job || state?.status !== 'failed') return;
  job.controller = new AbortController();
  run(job);
}

/** Stops the share and deletes everything already uploaded. */
export function discardShare() {
  clearTimeout(doneTimer);
  const current = job;
  job = null;
  setState(null);
  if (!current) return;
  current.controller.abort();
  current.draft.items.forEach((item, i) => {
    discardUploadSession(current.sessions[i]!, item.media).catch(() => {});
    const id = current.mediaIds[i];
    if (id) mediaApi.remove(id).catch(() => {});
  });
}

export function dismissShared() {
  if (state?.status === 'done') {
    clearTimeout(doneTimer);
    setState(null);
  }
}

export function onPostShared(listener: (post: Post) => void) {
  sharedListeners.add(listener);
  return () => {
    sharedListeners.delete(listener);
  };
}

export function useShareState() {
  return useSyncExternalStore(subscribe, () => state);
}
