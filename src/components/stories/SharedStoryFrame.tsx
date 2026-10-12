import { type ReactNode, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { SharedLayout, StoryShared } from '@/services/api/stories';

const WHITE = '#FFFFFF';
const INK = '#111111';
const GUIDE = '#38BDF8';
const HEADER_H = 48;
const CAPTION_H = 40;
const LABEL_H = 34;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
/** Within this many pixels of the middle the frame snaps to it and a guide line shows. */
const SNAP = 10;
const TAP_SLOP = 6;
const TAP_MS = 300;

export const DEFAULT_SHARED_LAYOUT: SharedLayout = { x: 0.5, y: 0.5, scale: 1, style: 'media' };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const distance = (t: readonly { pageX: number; pageY: number }[]) =>
  Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY);

type Props = {
  shared: Pick<StoryShared, 'kind' | 'username' | 'avatar_url' | 'caption' | 'aspect_ratio'>;
  layout: SharedLayout;
  /** Makes the frame movable (drag), zoomable (pinch) and, for posts, tappable to switch the look. */
  onChange?: (layout: SharedLayout) => void;
  /** The photo or video; it fills the media area. */
  children: ReactNode;
};

/**
 * A post or reel placed on a story: plain photo with @username, or the full post card
 * (author, photo, caption). Same layout when editing and when watching the story.
 */
export function SharedStoryFrame({ shared, layout, onChange, children }: Props) {
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [guides, setGuides] = useState({ v: false, h: false });
  const reel = shared.kind === 'reel';
  const card = !reel && layout.style === 'card';
  const ratio = clamp(shared.aspect_ratio || 1, 0.8, 1.91);

  const mediaW = reel ? stage.w : Math.min(stage.w * 0.82, stage.h * 0.6 * ratio);
  const mediaH = reel ? stage.h : mediaW / ratio;
  const caption = card && shared.caption ? shared.caption : '';
  const boxH = card
    ? HEADER_H + mediaH + (caption ? CAPTION_H : 0)
    : reel
      ? mediaH
      : mediaH + LABEL_H;

  const latest = useRef({ layout, onChange, stage, card: !reel });
  latest.current = { layout, onChange, stage, card: !reel };
  const gesture = useRef({ start: layout, pinch: 0, scale: 1, at: 0, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!latest.current.onChange,
        onMoveShouldSetPanResponder: () => !!latest.current.onChange,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          gesture.current = {
            start: latest.current.layout,
            pinch: 0,
            scale: latest.current.layout.scale,
            at: Date.now(),
            moved: false,
          };
        },
        onPanResponderMove: (evt, g) => {
          const { stage: s, layout: now, onChange: emit } = latest.current;
          const state = gesture.current;
          const touches = evt.nativeEvent.touches;
          let scale = now.scale;
          if (touches.length >= 2) {
            const d = distance(touches);
            if (!state.pinch) {
              state.pinch = d;
              state.scale = now.scale;
            }
            scale = clamp((state.scale * d) / state.pinch, MIN_SCALE, MAX_SCALE);
            state.moved = true;
          } else {
            state.pinch = 0;
          }
          if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) state.moved = true;
          if (!s.w || !s.h) return;
          let x = state.start.x + g.dx / s.w;
          let y = state.start.y + g.dy / s.h;
          const v = Math.abs(x * s.w - s.w / 2) < SNAP;
          const h = Math.abs(y * s.h - s.h / 2) < SNAP;
          if (v) x = 0.5;
          if (h) y = 0.5;
          setGuides(prev => (prev.v === v && prev.h === h ? prev : { v, h }));
          emit?.({ ...now, x: clamp(x, -0.4, 1.4), y: clamp(y, -0.4, 1.4), scale });
        },
        onPanResponderRelease: () => {
          const { layout: now, onChange: emit, card: canToggle } = latest.current;
          const state = gesture.current;
          setGuides({ v: false, h: false });
          if (!state.moved && Date.now() - state.at < TAP_MS && canToggle) {
            emit?.({ ...now, style: now.style === 'card' ? 'media' : 'card' });
          }
        },
        onPanResponderTerminate: () => setGuides({ v: false, h: false }),
      }),
    [],
  );

  const ready = stage.w > 0 && stage.h > 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={e =>
        setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {ready ? (
        <View
          {...responder.panHandlers}
          pointerEvents={onChange ? 'auto' : 'none'}
          style={[
            styles.box,
            {
              width: mediaW,
              height: boxH,
              left: layout.x * stage.w - mediaW / 2,
              top: layout.y * stage.h - boxH / 2,
              transform: [{ scale: layout.scale }],
            },
            card && styles.card,
          ]}
        >
          {card ? (
            <View style={styles.header}>
              <Avatar uri={shared.avatar_url} name={shared.username} size={28} />
              <Text style={styles.headerName} numberOfLines={1}>
                {shared.username}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              { width: mediaW, height: mediaH },
              reel ? null : card ? styles.cardMedia : styles.media,
            ]}
          >
            {children}
          </View>
          {card && caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              <Text style={styles.bold}>{shared.username}</Text> {caption}
            </Text>
          ) : null}
          {!card && !reel ? (
            <Text style={styles.label} numberOfLines={1}>
              @{shared.username}
            </Text>
          ) : null}
        </View>
      ) : null}
      {guides.v ? <View pointerEvents="none" style={[styles.guideV, { left: stage.w / 2 }]} /> : null}
      {guides.h ? <View pointerEvents="none" style={[styles.guideH, { top: stage.h / 2 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  card: { backgroundColor: WHITE, borderRadius: 14, overflow: 'hidden' },
  media: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#000000' },
  cardMedia: { overflow: 'hidden', backgroundColor: '#000000' },
  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  headerName: { color: INK, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  caption: {
    height: CAPTION_H,
    lineHeight: CAPTION_H,
    paddingHorizontal: 12,
    color: INK,
    fontSize: 13.5,
  },
  bold: { fontWeight: '700' },
  label: {
    height: LABEL_H,
    lineHeight: LABEL_H,
    textAlign: 'center',
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75, backgroundColor: GUIDE },
  guideH: { position: 'absolute', left: 0, right: 0, height: 1.5, marginTop: -0.75, backgroundColor: GUIDE },
});
