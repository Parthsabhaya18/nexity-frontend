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
    };

export const STICKERS = [
  '😀',
  '😂',
  '❤️',
  '🔥',
  '✨',
  '🎉',
  '👍',
  '😍',
  '🙌',
  '💯',
  '🌟',
  '😎',
];

export function overlayId() {
  return `ov-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function placed<T extends StoryOverlay>(overlay: T): T {
  return { ...overlay, x: 0.5, y: 0.42, scale: 1, rotation: 0 };
}
