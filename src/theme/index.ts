import { createContext, useContext, useSyncExternalStore } from 'react';

export const brand = {
  primary: '#2563EB',
  bright: '#3B82F6',
  deep: '#1D4ED8',
  sky: '#38BDF8',
  navy: '#1E3A8A',
  tint: '#EFF6FF',
  white: '#FFFFFF',
  dark: '#0F172A',
} as const;

export const colors = {
  primary: brand.primary,
  primaryPressed: brand.deep,
  accent: brand.sky,
  tint: brand.tint,
  heading: brand.navy,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: brand.dark,
  textMuted: '#64748B',
  success: '#16A34A',
  danger: '#DC2626',
  border: '#E2E8F0',
} as const;

export const darkColors = {
  primary: brand.bright,
  primaryPressed: brand.primary,
  accent: brand.sky,
  tint: '#1E293B',
  heading: '#FFFFFF',
  background: brand.dark,
  surface: '#111C33',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  success: '#22C55E',
  danger: '#F87171',
  border: '#1E293B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  full: 999,
} as const;

/** Mood palette (light appearance) — see documentation/architecture/THEMING.md. */
export const moodPalettes = {
  happy: {
    background: '#FFFBEA',
    surface: '#FFFFFF',
    primary: '#F5B800',
    button: '#D99500',
    text: '#2B2200',
    textSecondary: '#756A3A',
    border: '#F5E7A8',
  },
  calm: {
    background: '#EFF8FF',
    surface: '#FFFFFF',
    primary: '#3B82F6',
    button: '#1D4ED8',
    text: '#0F2747',
    textSecondary: '#58708C',
    border: '#CFE5FA',
  },
  romantic: {
    background: '#FFF1F5',
    surface: '#FFFFFF',
    primary: '#EC4899',
    button: '#BE185D',
    text: '#3B0A1E',
    textSecondary: '#87506A',
    border: '#F7C6D8',
  },
  sad: {
    background: '#EEF2FF',
    surface: '#FFFFFF',
    primary: '#6366F1',
    button: '#4338CA',
    text: '#171B3A',
    textSecondary: '#626A91',
    border: '#D5D9F5',
  },
  angry: {
    background: '#FFF1F1',
    surface: '#FFFFFF',
    primary: '#EF4444',
    button: '#B91C1C',
    text: '#350909',
    textSecondary: '#824343',
    border: '#F6CACA',
  },
  cool: {
    background: '#F5F3FF',
    surface: '#FFFFFF',
    primary: '#8B5CF6',
    button: '#6D28D9',
    text: '#21133D',
    textSecondary: '#6B5A82',
    border: '#DDD4FE',
  },
  relaxed: {
    background: '#F1FAF4',
    surface: '#FFFFFF',
    primary: '#22C55E',
    button: '#15803D',
    text: '#0B2B18',
    textSecondary: '#557562',
    border: '#CBEBD5',
  },
  excited: {
    background: '#FFF5ED',
    surface: '#FFFFFF',
    primary: '#F97316',
    button: '#C2410C',
    text: '#351306',
    textSecondary: '#875D45',
    border: '#F6D0BA',
  },
  tired: {
    background: '#F5F3F7',
    surface: '#FFFFFF',
    primary: '#8B7FA8',
    button: '#625477',
    text: '#292432',
    textSecondary: '#756D7D',
    border: '#DDD8E5',
  },
  motivated: {
    background: '#EEFDFD',
    surface: '#FFFFFF',
    primary: '#06B6D4',
    button: '#0E7490',
    text: '#062B32',
    textSecondary: '#4C7278',
    border: '#BFE8EE',
  },
} as const;

export type Mood = keyof typeof moodPalettes;
export const DEFAULT_MOOD: Mood = 'calm';

export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  button: string;
  onButton: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBackground: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  primarySoft: string;
  /** Faint primary wash for unread rows. */
  primarySofter: string;
  /** Muted fill for chips and secondary surfaces. */
  surfaceAlt: string;
  /** Count badges on header icons. */
  accent: string;
  like: string;
  /** DM bubbles sent by me; text on it is `onButton`. */
  bubbleOutgoing: string;
  /** DM bubbles received; text on it is `text`. */
  bubbleIncoming: string;
  /** Presence dot on avatars. */
  online: string;
  /** Bottom sheets, modals and menus. */
  surfaceElevated: string;
  /** Scrim behind sheets and modals. */
  overlay: string;
  /** Loading placeholders. */
  skeleton: string;
  /** The moving shine on top of `skeleton`. */
  skeletonHighlight: string;
};

const status = { danger: '#ED4956', success: '#12935A' } as const;

/** Neutral light theme. Moods are separate and only apply when one is selected. */
export const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  primary: '#0095F6',
  button: '#0095F6',
  onButton: '#FFFFFF',
  text: '#000000',
  textSecondary: '#737373',
  border: '#DBDBDB',
  inputBackground: '#FAFAFA',
  danger: status.danger,
  dangerSoft: '#FDEBEC',
  success: status.success,
  successSoft: '#E3F5EC',
  primarySoft: 'rgba(0, 149, 246, 0.12)',
  primarySofter: 'rgba(0, 149, 246, 0.06)',
  surfaceAlt: '#EFEFEF',
  accent: '#E5487E',
  like: '#F0386B',
  bubbleOutgoing: '#3797F0',
  bubbleIncoming: '#EFEFEF',
  online: '#22C55E',
  surfaceElevated: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.4)',
  skeleton: '#EFEFEF',
  skeletonHighlight: '#FAFAFA',
};

const darkTheme: ThemeColors = {
  background: '#000000',
  surface: '#121212',
  primary: '#0095F6',
  button: '#0095F6',
  onButton: '#FFFFFF',
  text: '#F5F5F5',
  textSecondary: '#A8A8A8',
  border: '#363636',
  inputBackground: '#262626',
  danger: status.danger,
  dangerSoft: 'rgba(237, 73, 86, 0.16)',
  success: '#34C47F',
  successSoft: 'rgba(52, 196, 127, 0.16)',
  primarySoft: 'rgba(0, 149, 246, 0.16)',
  primarySofter: 'rgba(0, 149, 246, 0.08)',
  surfaceAlt: '#1C1C1C',
  accent: '#F0679B',
  like: '#F0386B',
  bubbleOutgoing: '#3797F0',
  bubbleIncoming: '#262626',
  online: '#22C55E',
  surfaceElevated: '#262626',
  overlay: 'rgba(0, 0, 0, 0.65)',
  skeleton: '#262626',
  skeletonHighlight: '#363636',
};

export function moodColors(mood: Mood): ThemeColors {
  const p = moodPalettes[mood];
  return {
    ...p,
    onButton: '#FFFFFF',
    inputBackground: '#FFFFFF',
    danger: status.danger,
    dangerSoft: '#FDEBEC',
    success: status.success,
    successSoft: '#E3F5EC',
    primarySoft: `${p.primary}1F`,
    primarySofter: `${p.primary}12`,
    surfaceAlt: `${p.border}80`,
    accent: '#E5487E',
    like: '#F0386B',
    bubbleOutgoing: p.button,
    bubbleIncoming: `${p.border}80`,
    online: '#22C55E',
    surfaceElevated: p.background,
    overlay: `${p.text}80`,
    skeleton: `${p.border}CC`,
    skeletonHighlight: p.background,
  };
}

/** Brand gradient stops (135°). Light moods use their primary → button instead. */
export const brandGradient = ['#38BDF8', '#3B82F6', '#1D4ED8'] as const;

/** Colours that stay fixed on full-bleed dark screens such as Reels. */
export const darkScreen = {
  background: '#000000',
  iconTile: 'rgba(255, 255, 255, 0.12)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  navBackground: 'rgba(8, 6, 12, 0.88)',
  navBorder: 'rgba(255, 255, 255, 0.1)',
  navInactive: 'rgba(255, 255, 255, 0.55)',
} as const;

export type ThemeChoice = 'light' | 'dark' | 'system';

export type AppTheme = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  gradient: readonly string[];
  /** The saved choice. A mood replaces it until removed. */
  choice: ThemeChoice;
  mood: Mood | null;
};

export function resolveTheme(
  choice: ThemeChoice,
  mood: Mood | null,
  system: 'light' | 'dark',
): AppTheme {
  const scheme: 'light' | 'dark' = mood
    ? 'light'
    : choice === 'system'
    ? system
    : choice;
  const colors = mood
    ? moodColors(mood)
    : scheme === 'dark'
    ? darkTheme
    : lightTheme;
  const gradient =
    scheme === 'dark' && !mood
      ? brandGradient
      : [colors.primary, colors.button];
  return { scheme, colors, gradient, choice, mood };
}

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: AppTheme = resolveTheme('system', null, 'light');

export function getAppTheme() {
  return snapshot;
}

/** Called by ThemeProvider. Ignored when nothing visible changed. */
export function publishTheme(next: AppTheme) {
  if (
    snapshot.scheme === next.scheme &&
    snapshot.choice === next.choice &&
    snapshot.mood === next.mood &&
    snapshot.colors === next.colors
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach(l => l());
}

/** Set by `ThemeScope` to show part of the tree in another theme. */
export const ThemeOverrideContext = createContext<AppTheme | null>(null);

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useAppTheme() {
  const override = useContext(ThemeOverrideContext);
  const global = useSyncExternalStore(subscribe, getAppTheme);
  return override ?? global;
}
