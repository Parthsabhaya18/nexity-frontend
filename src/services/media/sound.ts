type Sound = ReturnType<typeof import('react-native-nitro-sound').createSound>;

let recorder: Sound | null | undefined;
let player: Sound | null | undefined;

/**
 * Loaded on first use: an app binary built before the native module was added
 * would otherwise crash as soon as the chat screen is imported.
 */
function create(): Sound | null {
  try {
    return (
      require('react-native-nitro-sound') as typeof import('react-native-nitro-sound')
    ).createSound();
  } catch {
    return null;
  }
}

/** Separate instances, so playing a voice note never touches a recording in progress. */
export function voiceRecorder() {
  if (recorder === undefined) recorder = create();
  return recorder;
}

export function voicePlayer() {
  if (player === undefined) player = create();
  return player;
}

export const SOUND_UNAVAILABLE = 'Voice messages need the latest app build.';
