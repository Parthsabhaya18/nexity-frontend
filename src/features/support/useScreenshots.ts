import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_ITEMS } from '@/features/media/mediaRules';
import type { LocalMedia } from '@/features/media/pickMedia';
import {
  discardUploadSession,
  isUploadCancelled,
  uploadErrorMessage,
  uploadMedia,
  type UploadSession,
} from '@/features/media/uploadMedia';
import { mediaApi } from '@/services/api/media';

export const MAX_SCREENSHOTS = MAX_ITEMS.support;

export interface Screenshot {
  key: string;
  media: LocalMedia;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  mediaId?: string;
  error?: string;
}

interface Job {
  session: UploadSession;
  controller?: AbortController;
}

let nextKey = 0;

/**
 * Contact us screenshots: each one uploads on its own as soon as it is added,
 * so adding or removing one never restarts the others. Uploads that are never
 * sent with a request are deleted when the screen closes.
 */
export function useScreenshots() {
  const [shots, setShots] = useState<Screenshot[]>([]);
  const shotsRef = useRef<Screenshot[]>([]);
  const jobs = useRef(new Map<string, Job>());
  const sent = useRef(false);

  const commit = useCallback(
    (update: (list: Screenshot[]) => Screenshot[]) => {
      shotsRef.current = update(shotsRef.current);
      setShots(shotsRef.current);
    },
    [],
  );

  const patch = useCallback(
    (key: string, change: Partial<Screenshot>) =>
      commit(list => list.map(s => (s.key === key ? { ...s, ...change } : s))),
    [commit],
  );

  const run = useCallback(
    async (key: string, media: LocalMedia) => {
      const job = jobs.current.get(key) ?? { session: {} };
      job.controller = new AbortController();
      jobs.current.set(key, job);
      patch(key, { status: 'uploading', progress: 0, error: undefined });
      let lastPct = -1;
      try {
        const asset = await uploadMedia(media, 'support', {
          session: job.session,
          signal: job.controller.signal,
          onProgress: f => {
            const pct = Math.floor(f * 100);
            if (pct === lastPct) return;
            lastPct = pct;
            patch(key, { progress: f });
          },
        });
        patch(key, { status: 'done', progress: 1, mediaId: asset.id });
      } catch (err) {
        if (isUploadCancelled(err)) return;
        patch(key, { status: 'error', error: uploadErrorMessage(err) });
      }
    },
    [patch],
  );

  const add = useCallback(
    (medias: LocalMedia[]) => {
      const room = MAX_SCREENSHOTS - shotsRef.current.length;
      const added = medias.slice(0, Math.max(0, room)).map(media => ({
        key: `shot-${++nextKey}`,
        media,
        status: 'uploading' as const,
        progress: 0,
      }));
      commit(list => [...list, ...added]);
      added.forEach(s => run(s.key, s.media));
      return medias.length - added.length;
    },
    [commit, run],
  );

  const retry = useCallback(
    (key: string) => {
      const shot = shotsRef.current.find(s => s.key === key);
      if (shot?.status === 'error') run(key, shot.media);
    },
    [run],
  );

  const release = useCallback((shot: Screenshot) => {
    const job = jobs.current.get(shot.key);
    jobs.current.delete(shot.key);
    job?.controller?.abort();
    if (shot.mediaId) mediaApi.remove(shot.mediaId).catch(() => {});
    else if (job) discardUploadSession(job.session, shot.media).catch(() => {});
  }, []);

  const remove = useCallback(
    (key: string) => {
      const shot = shotsRef.current.find(s => s.key === key);
      if (shot) release(shot);
      commit(list => list.filter(s => s.key !== key));
    },
    [commit, release],
  );

  const clear = useCallback(() => {
    shotsRef.current.forEach(release);
    commit(() => []);
  }, [commit, release]);

  /** Call once the request is created, so its screenshots are kept. */
  const markSent = useCallback(() => {
    sent.current = true;
  }, []);

  useEffect(
    () => () => {
      if (!sent.current) shotsRef.current.forEach(release);
    },
    [release],
  );

  return {
    shots,
    add,
    retry,
    remove,
    clear,
    markSent,
    isUploading: shots.some(s => s.status === 'uploading'),
    hasFailed: shots.some(s => s.status === 'error'),
    mediaIds: shots.flatMap(s => (s.mediaId ? [s.mediaId] : [])),
  };
}
