export const STORY_FONTS = [
  'classic',
  'modern',
  'strong',
  'typewriter',
  'serif',
  'script',
] as const;
export type StoryFont = (typeof STORY_FONTS)[number];

export const STORY_BRUSHES = ['pen', 'arrow', 'marker', 'neon'] as const;
export type StoryBrush = (typeof STORY_BRUSHES)[number];

export const STORY_ALIGNS = ['center', 'left', 'right'] as const;
export type StoryAlign = (typeof STORY_ALIGNS)[number];

export type StoryOverlay =
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      text: string;
      color: string;
      background: string | null;
      font?: StoryFont;
      align?: StoryAlign;
    }
  | {
      id: string;
      type: 'sticker';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      emoji: string;
    }
  | {
      id: string;
      type: 'draw';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      color: string;
      points: number[];
      /** Stroke width as a percentage of the story width. */
      width?: number;
      brush?: StoryBrush;
    }
  | {
      id: string;
      type: 'poll';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      question: string;
      options: string[];
      votes?: number[];
    }
  | {
      id: string;
      type: 'question';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      prompt: string;
    }
  | {
      id: string;
      type: 'quiz';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      question: string;
      options: string[];
      answer: number;
    }
  | {
      id: string;
      type: 'countdown';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      title: string;
      ends_at: string;
    }
  | {
      id: string;
      type: 'link';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      label: string;
      url: string;
    }
  | {
      id: string;
      type: 'hashtag';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      tag: string;
    }
  | {
      id: string;
      type: 'mention';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      username: string;
    }
  | {
      id: string;
      type: 'location';
      x: number;
      y: number;
      scale: number;
      rotation: number;
      name: string;
    };

export const MAX_OVERLAYS = 30;

export const STORY_COLORS = [
  '#FFFFFF',
  '#000000',
  '#9CA3AF',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#FACC15',
  '#A3E635',
  '#22C55E',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#92400E',
];

export function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, l };
}

export function overlayId() {
  return `ov-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function placed<T extends StoryOverlay>(overlay: T): T {
  return { ...overlay, x: 0.5, y: 0.42, scale: 1, rotation: 0 };
}
