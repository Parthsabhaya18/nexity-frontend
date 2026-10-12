import type { BubbleRect } from './MessageBubble';

export const OVERLAY_GAP = 8;
export const OVERLAY_MARGIN = 12;

export type OverlayInput = {
  /** Bubble position relative to the overlay. */
  bubble: BubbleRect;
  screen: { width: number; height: number };
  insets: { top: number; bottom: number };
  bar: { width: number; height: number };
  menu: { width: number; height: number };
  mine: boolean;
};

export type OverlayLayout = {
  /** Where the bubble copy sits; it slides there from its real position. */
  bubbleTop: number;
  /** Shorter than the real bubble only when it can't fit with the bar and menu. */
  bubbleHeight: number;
  barTop: number;
  barLeft: number;
  menuTop: number;
  menuLeft: number;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Reaction bar above the message, menu below it, both aligned with the bubble's side.
 * The stack is shifted (never resized) to stay on screen; a very tall bubble is clipped.
 */
export function layoutOverlay({
  bubble,
  screen,
  insets,
  bar,
  menu,
  mine,
}: OverlayInput): OverlayLayout {
  const top = insets.top + OVERLAY_MARGIN;
  const bottom = screen.height - insets.bottom - OVERLAY_MARGIN;
  const room = bottom - top - bar.height - menu.height - OVERLAY_GAP * 2;
  const bubbleHeight = Math.max(0, Math.min(bubble.height, room));
  const total = bar.height + bubbleHeight + menu.height + OVERLAY_GAP * 2;

  const stackTop = clamp(bubble.y - OVERLAY_GAP - bar.height, top, bottom - total);
  const bubbleTop = stackTop + bar.height + OVERLAY_GAP;

  const alignTo = (width: number) =>
    clamp(
      mine ? bubble.x + bubble.width - width : bubble.x,
      OVERLAY_MARGIN,
      screen.width - OVERLAY_MARGIN - width,
    );

  return {
    bubbleTop,
    bubbleHeight,
    barTop: stackTop,
    barLeft: alignTo(bar.width),
    menuTop: bubbleTop + bubbleHeight + OVERLAY_GAP,
    menuLeft: alignTo(menu.width),
  };
}
