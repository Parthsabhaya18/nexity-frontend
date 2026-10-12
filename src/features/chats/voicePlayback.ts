import { useSyncExternalStore } from 'react';

import { SOUND_UNAVAILABLE, voicePlayer } from '@/services/media/sound';

export type VoicePlayback = {
  /** Message whose voice note is loaded; `null` when nothing is. */
  id: string | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
};

const IDLE: VoicePlayback = {
  id: null,
  playing: false,
  positionMs: 0,
  durationMs: 0,
};

let state = IDLE;
const listeners = new Set<() => void>();

function set(next: Partial<VoicePlayback>) {
  state = { ...state, ...next };
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Only one voice note plays at a time, like Instagram. */
export const voicePlayback = {
  async toggle(id: string, url: string, onError: (message: string) => void) {
    const player = voicePlayer();
    if (!player) {
      onError(SOUND_UNAVAILABLE);
      return;
    }
    if (state.id === id) {
      if (state.playing) {
        set({ playing: false });
        await player.pausePlayer().catch(() => {});
        return;
      }
      if (state.durationMs && state.positionMs < state.durationMs) {
        set({ playing: true });
        await player.resumePlayer().catch(() => {});
        return;
      }
    }
    await player.stopPlayer().catch(() => {});
    set({ id, playing: true, positionMs: 0, durationMs: 0 });
    player.setSubscriptionDuration(0.1);
    player.addPlayBackListener(e => {
      if (state.id !== id) return;
      set({ positionMs: e.currentPosition, durationMs: e.duration });
    });
    player.addPlaybackEndListener(() => {
      if (state.id !== id) return;
      set({ playing: false, positionMs: 0 });
    });
    try {
      await player.startPlayer(url);
    } catch {
      if (state.id === id) set(IDLE);
      onError("Couldn't play this voice message.");
    }
  },

  stop() {
    if (!state.id) return;
    set(IDLE);
    const player = voicePlayer();
    player?.removePlayBackListener();
    player?.removePlaybackEndListener();
    player?.stopPlayer().catch(() => {});
  },
};

/** Playback of this message's voice note, or the idle state when another one is loaded. */
export function useVoicePlayback(id: string): VoicePlayback {
  return useSyncExternalStore(subscribe, () => (state.id === id ? state : IDLE));
}
