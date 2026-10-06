import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import {
  Baseline,
  CaseSensitive,
  Check,
  Eraser,
  Highlighter,
  type LucideIcon,
  MapPin,
  MoveUpRight,
  PaintBucket,
  Pen,
  Signature,
  Sparkles,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Polygon,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  hexToHsl,
  hslToHex,
  MAX_OVERLAYS,
  overlayId,
  placed,
  STORY_ALIGNS,
  STORY_BRUSHES,
  STORY_COLORS,
  STORY_FONTS,
  type StoryAlign,
  type StoryBrush,
  type StoryFont,
  type StoryOverlay,
} from '@/features/stories/overlay';
import { useKeyboardVisible } from '@/components/chat/useKeyboardVisible';
import { darkScreen } from '@/theme';

const FONTS: Record<StoryFont, { label: string; style: TextStyle }> = {
  classic: { label: 'Classic', style: { fontWeight: '800' } },
  modern: {
    label: 'Modern',
    style: {
      fontFamily: Platform.select({ ios: 'Avenir Next', default: 'sans-serif-light' }),
      fontWeight: '500',
    },
  },
  strong: {
    label: 'Strong',
    style: {
      fontFamily: Platform.select({ ios: 'Futura', default: 'sans-serif-condensed' }),
      fontWeight: '900',
      textTransform: 'uppercase',
    },
  },
  typewriter: {
    label: 'Typewriter',
    style: {
      fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
      fontWeight: '700',
    },
  },
  serif: {
    label: 'Serif',
    style: {
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontWeight: '700',
      fontStyle: 'italic',
    },
  },
  script: {
    label: 'Script',
    style: {
      fontFamily: Platform.select({ ios: 'Snell Roundhand', default: 'cursive' }),
      fontWeight: '700',
    },
  },
};

type DrawTool = StoryBrush | 'eraser';

const TOOLS: Record<DrawTool, { label: string; icon: LucideIcon }> = {
  pen: { label: 'Pen', icon: Pen },
  arrow: { label: 'Arrow', icon: MoveUpRight },
  marker: { label: 'Marker', icon: Highlighter },
  neon: { label: 'Neon', icon: Sparkles },
  eraser: { label: 'Eraser', icon: Eraser },
};
const TOOL_ORDER: DrawTool[] = [...STORY_BRUSHES, 'eraser'];

const ALIGN_ICONS: Record<StoryAlign, LucideIcon> = {
  center: TextAlignCenter,
  left: TextAlignStart,
  right: TextAlignEnd,
};

const EDGE: Record<StoryAlign, ViewStyle> = {
  center: { alignItems: 'center' },
  left: { alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
};

/** Where a text sticker's anchor goes when its alignment changes. */
const ALIGN_X: Record<StoryAlign, number> = { center: 0.5, left: 0.06, right: 0.94 };

const MIN_WIDTH = 0.4;
const MAX_WIDTH = 6;
const TEXT_SIZE = 26;

type Props = {
  overlays: StoryOverlay[];
  editable?: boolean;
  onChange?: (next: StoryOverlay[]) => void;
  onVote?: (overlayId: string, option: number) => void;
  onReply?: (overlayId: string) => void;
  onAddLocation?: () => void;
  /** True while typing, drawing or dragging, so the screen can hide its own buttons. */
  onFocusChange?: (focused: boolean) => void;
};

type TextDraft = {
  id: string | null;
  text: string;
  color: string;
  background: string;
  boxed: boolean;
  /** Which of the two colors the color row changes. */
  paint: 'text' | 'background';
  font: StoryFont;
  align: StoryAlign;
  scale: number;
};

const newDraft = (): TextDraft => ({
  id: null,
  text: '',
  color: STORY_COLORS[0]!,
  background: '#000000',
  boxed: false,
  paint: 'text',
  font: 'classic',
  align: 'center',
  scale: 1,
});
type Size = { w: number; h: number };
type Placed = Exclude<StoryOverlay, { type: 'draw' }>;

const TRASH_SIZE = 56;
const TRASH_BOTTOM = 32;

/** Text, location and drawing, saved with the story. */
export function StoryStage({
  overlays,
  editable,
  onChange,
  onVote,
  onReply,
  onAddLocation,
  onFocusChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<Size>({ w: 1, h: 1 });
  const [draw, setDraw] = useState(false);
  const [drawColor, setDrawColor] = useState(STORY_COLORS[0]!);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [strokeWidth, setStrokeWidth] = useState(1.2);
  const [draftStroke, setDraftStroke] = useState<number[]>([]);
  const [draft, setDraft] = useState<TextDraft | null>(null);
  const [panel, setPanel] = useState<'font' | 'color'>('font');
  const keyboardOpen = useKeyboardVisible();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const stroke = useRef<number[]>([]);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const drawOn = useRef(false);
  drawOn.current = draw;
  const drawColorRef = useRef(drawColor);
  drawColorRef.current = drawColor;
  const brushRef = useRef({ tool, width: strokeWidth });
  brushRef.current = { tool, width: strokeWidth };
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFocusRef = useRef(onFocusChange);
  onFocusRef.current = onFocusChange;

  const focused = draw || !!draft || !!dragging;
  useEffect(() => {
    onFocusRef.current?.(focused);
  }, [focused]);

  const add = (overlay: StoryOverlay) => {
    const current = overlaysRef.current;
    if (current.length >= MAX_OVERLAYS) {
      Alert.alert(`A story can have up to ${MAX_OVERLAYS} items.`);
      return;
    }
    onChangeRef.current?.([...current, overlay]);
  };

  /** Removes every stroke that passes under the finger. */
  const eraseAt = (x: number, y: number) => {
    const { w, h } = sizeRef.current;
    const radius = Math.max(16, (brushRef.current.width * w) / 100);
    const current = overlaysRef.current;
    const next = current.filter(o => {
      if (o.type !== 'draw') return true;
      for (let i = 0; i < o.points.length; i += 2) {
        if (Math.hypot(o.points[i]! * w - x, o.points[i + 1]! * h - y) < radius)
          return false;
      }
      return true;
    });
    if (next.length !== current.length) onChangeRef.current?.(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawOn.current,
      onMoveShouldSetPanResponder: () => drawOn.current,
      onPanResponderGrant: evt => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        if (brushRef.current.tool === 'eraser') {
          eraseAt(x, y);
          return;
        }
        stroke.current = [x, y];
        setDraftStroke([x, y]);
      },
      onPanResponderMove: evt => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        if (brushRef.current.tool === 'eraser') {
          eraseAt(x, y);
          return;
        }
        const next = [...stroke.current, x, y].slice(-200);
        stroke.current = next;
        setDraftStroke(next);
      },
      onPanResponderRelease: () => {
        const { w, h } = sizeRef.current;
        const { tool: current } = brushRef.current;
        const points = toUnit(stroke.current, w, h);
        if (current !== 'eraser' && points.length >= 4) {
          add({
            id: overlayId(),
            type: 'draw',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            color: drawColorRef.current,
            points,
            width: Math.round(brushRef.current.width * 100) / 100,
            brush: current,
          });
        }
        stroke.current = [];
        setDraftStroke([]);
      },
    }),
  ).current;

  const commitText = () => {
    if (!draft) return;
    const value = draft.text.trim();
    const current = overlaysRef.current;
    const look = {
      text: value,
      color: draft.color,
      background: draft.boxed ? draft.background : null,
      font: draft.font,
      align: draft.align,
      scale: Math.round(draft.scale * 100) / 100,
    };
    if (draft.id) {
      onChange?.(
        value
          ? current.map(o =>
              o.id === draft.id && o.type === 'text'
                ? {
                    ...o,
                    ...look,
                    x:
                      (o.align ?? 'center') === draft.align
                        ? o.x
                        : ALIGN_X[draft.align],
                  }
                : o,
            )
          : current.filter(o => o.id !== draft.id),
      );
    } else if (value) {
      add({
        ...placed({
          id: overlayId(),
          type: 'text',
          x: 0,
          y: 0,
          rotation: 0,
          ...look,
        }),
        x: ALIGN_X[draft.align],
        scale: look.scale,
      });
    }
    setDraft(null);
  };

  const isOverTrash = (x: number, y: number) => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h - insets.bottom - TRASH_BOTTOM - TRASH_SIZE / 2;
    return Math.hypot(x - cx, y - cy) < TRASH_SIZE;
  };

  const lastDraw = [...overlays].reverse().find(o => o.type === 'draw');

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <View
        style={styles.fill}
        pointerEvents={draw ? 'auto' : 'box-none'}
        onLayout={e =>
          setSize({
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }
        {...(draw ? pan.panHandlers : {})}
      >
        {editable && !focused ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDraft(newDraft())}
            accessibilityRole="button"
            accessibilityLabel="Tap to add text"
          />
        ) : null}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {overlays.map(item =>
            item.type === 'draw' ? (
              <Stroke
                key={item.id}
                points={toPx(item.points, size)}
                color={item.color}
                width={((item.width ?? 1.2) * size.w) / 100}
                brush={item.brush ?? 'pen'}
              />
            ) : null,
          )}
        </Svg>
        {overlays
          .filter(
            (item): item is Placed =>
              item.type !== 'draw' && item.id !== draft?.id,
          )
          .map(item => (
            <OverlayView
              key={item.id}
              item={item}
              stage={size}
              editable={!!editable && !draw && !draft}
              fading={dragging === item.id && overTrash}
              isOverTrash={isOverTrash}
              onMove={(x, y) =>
                onChangeRef.current?.(
                  overlaysRef.current.map(row =>
                    row.id === item.id ? { ...row, x, y } : row,
                  ),
                )
              }
              onTransform={(scale, rotation) =>
                onChangeRef.current?.(
                  overlaysRef.current.map(row =>
                    row.id === item.id ? { ...row, scale, rotation } : row,
                  ),
                )
              }
              onTap={() => {
                if (item.type === 'text') {
                  setDraft({
                    id: item.id,
                    text: item.text,
                    color: item.color,
                    background: item.background ?? contrast(item.color),
                    boxed: !!item.background,
                    paint: 'text',
                    font: item.font ?? 'classic',
                    align: item.align ?? 'center',
                    scale: item.scale || 1,
                  });
                } else if (item.type === 'location') {
                  onAddLocation?.();
                }
              }}
              onDrag={over => {
                setDragging(item.id);
                setOverTrash(over);
              }}
              onDrop={over => {
                if (over) {
                  onChangeRef.current?.(
                    overlaysRef.current.filter(row => row.id !== item.id),
                  );
                }
                setDragging(null);
                setOverTrash(false);
              }}
              onVote={option => onVote?.(item.id, option)}
              onReply={() => onReply?.(item.id)}
            />
          ))}
        {draftStroke.length >= 4 ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Stroke
              points={draftStroke}
              color={drawColor}
              width={(strokeWidth * size.w) / 100}
              brush={tool === 'eraser' ? 'pen' : tool}
            />
          </Svg>
        ) : null}
      </View>

      {editable && !focused ? (
        <View
          style={[styles.rail, { top: insets.top + 4 }]}
          pointerEvents="box-none"
        >
          <RailButton
            label="Add text"
            onPress={() => setDraft(newDraft())}
          >
            <Type size={22} color="#FFFFFF" />
          </RailButton>
          {onAddLocation ? (
            <RailButton label="Add location" onPress={onAddLocation}>
              <MapPin size={22} color="#FFFFFF" />
            </RailButton>
          ) : null}
          <RailButton label="Draw" onPress={() => setDraw(true)}>
            <Signature size={22} color="#FFFFFF" />
          </RailButton>
        </View>
      ) : null}

      {editable && draw ? (
        <>
          <View
            style={[styles.drawTop, { top: insets.top + 4 }]}
            pointerEvents="box-none"
          >
            <RailButton
              label="Undo"
              disabled={!lastDraw}
              onPress={() =>
                lastDraw &&
                onChange?.(overlays.filter(o => o.id !== lastDraw.id))
              }
            >
              <Undo2 size={20} color={lastDraw ? '#FFFFFF' : 'rgba(255,255,255,0.35)'} />
            </RailButton>
            {TOOL_ORDER.map(kind => {
              const Icon = TOOLS[kind].icon;
              return (
                <RailButton
                  key={kind}
                  label={TOOLS[kind].label}
                  on={tool === kind}
                  onPress={() => setTool(kind)}
                >
                  <Icon size={20} color={tool === kind ? '#111111' : '#FFFFFF'} />
                </RailButton>
              );
            })}
            <Pressable
              onPress={() => setDraw(false)}
              accessibilityRole="button"
              accessibilityLabel="Done drawing"
              hitSlop={8}
              style={styles.doneIcon}
            >
              <Check size={28} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={[styles.sliderWrap, { top: insets.top + 64 }]} pointerEvents="box-none">
            <SizeSlider
              label="Brush size"
              value={strokeWidth}
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              preview={{ color: drawColor, size: (strokeWidth * size.w) / 100 }}
              onChange={setStrokeWidth}
            />
          </View>
          <View
            style={[styles.drawColors, { bottom: insets.bottom + 16 }]}
            pointerEvents="box-none"
          >
            <ColorRow value={drawColor} onPick={setDrawColor} />
          </View>
        </>
      ) : null}

      {dragging ? (
        <View
          style={[styles.trashWrap, { bottom: insets.bottom + TRASH_BOTTOM }]}
          pointerEvents="none"
        >
          <View style={[styles.trash, overTrash && styles.trashOn]}>
            <Trash2 size={overTrash ? 28 : 24} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      {draft ? (
        // Edge-to-edge Android no longer resizes the window for the keyboard,
        // so padding is needed on both platforms.
        <KeyboardAvoidingView style={styles.editor} behavior="padding">
          <View style={[styles.editorTop, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={commitText}
              accessibilityRole="button"
              accessibilityLabel="Done"
              hitSlop={8}
              style={[styles.railButton, styles.railButtonOn]}
            >
              <Check size={22} color="#111111" />
            </Pressable>
          </View>
          <Pressable
            style={[styles.editorCenter, EDGE[draft.align]]}
            onPress={commitText}
            accessible={false}
          >
            <TextInput
              value={draft.text}
              onChangeText={text => setDraft(d => (d ? { ...d, text } : d))}
              autoFocus
              multiline
              maxLength={200}
              textAlign={draft.align}
              selectionColor={draft.color}
              accessibilityLabel="Story text"
              style={[
                styles.editorInput,
                FONTS[draft.font].style,
                draft.boxed
                  ? [styles.textBoxed, { backgroundColor: draft.background }]
                  : textShadow(draft.color),
                {
                  color: draft.color,
                  fontSize: TEXT_SIZE * draft.scale,
                  textAlign: draft.align,
                  maxWidth: size.w - 80,
                },
              ]}
            />
            <View style={styles.editorSlider} pointerEvents="box-none">
              <SizeSlider
                label="Text size"
                value={draft.scale}
                min={0.5}
                max={3}
                onChange={scale => setDraft(d => (d ? { ...d, scale } : d))}
              />
            </View>
          </Pressable>
          <View
            style={[
              styles.dock,
              { paddingBottom: keyboardOpen ? 10 : insets.bottom + 10 },
            ]}
          >
            {panel === 'font' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.fonts}
              >
                {STORY_FONTS.map(font => (
                  <Chip
                    key={font}
                    label={FONTS[font].label}
                    accessibilityLabel={`${FONTS[font].label} font`}
                    labelStyle={FONTS[font].style}
                    on={draft.font === font}
                    onPress={() => setDraft(d => (d ? { ...d, font } : d))}
                  />
                ))}
              </ScrollView>
            ) : (
              <ColorRow
                key={draft.boxed ? draft.paint : 'text'}
                value={
                  draft.boxed && draft.paint === 'background'
                    ? draft.background
                    : draft.color
                }
                onPick={color =>
                  setDraft(d =>
                    d
                      ? d.boxed && d.paint === 'background'
                        ? { ...d, background: color }
                        : { ...d, color }
                      : d,
                  )
                }
              />
            )}
            <View style={styles.toolbar}>
              <Tab
                label="Font"
                icon={CaseSensitive}
                on={panel === 'font'}
                onPress={() => setPanel('font')}
              />
              <Pressable
                onPress={() => setPanel('color')}
                accessibilityRole="tab"
                accessibilityLabel="Color"
                accessibilityState={{ selected: panel === 'color' }}
                hitSlop={6}
                style={[styles.tab, panel === 'color' && styles.tabOn]}
              >
                <RainbowDot size={24} />
              </Pressable>
              <Pressable
                onPress={() =>
                  setDraft(d =>
                    d
                      ? {
                          ...d,
                          align:
                            STORY_ALIGNS[
                              (STORY_ALIGNS.indexOf(d.align) + 1) % STORY_ALIGNS.length
                            ]!,
                        }
                      : d,
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Text alignment ${draft.align}`}
                hitSlop={6}
                style={styles.tab}
              >
                {(() => {
                  const AlignIcon = ALIGN_ICONS[draft.align];
                  return <AlignIcon size={22} color="#FFFFFF" />;
                })()}
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!draft.boxed) setPanel('color');
                  setDraft(d =>
                    d
                      ? {
                          ...d,
                          boxed: !d.boxed,
                          paint: d.boxed ? 'text' : 'background',
                          background:
                            !d.boxed && d.background === d.color
                              ? contrast(d.color)
                              : d.background,
                        }
                      : d,
                  );
                }}
                accessibilityRole="switch"
                accessibilityLabel="Background behind text"
                accessibilityState={{ checked: draft.boxed }}
                hitSlop={8}
                style={[styles.boxToggle, draft.boxed && styles.boxToggleOn]}
              >
                <Text
                  style={[styles.boxToggleText, draft.boxed && styles.boxToggleTextOn]}
                >
                  A
                </Text>
              </Pressable>
              {panel === 'color' && draft.boxed ? (
                <View style={styles.segment}>
                  {(['text', 'background'] as const).map(paint => {
                    const Icon = paint === 'text' ? Baseline : PaintBucket;
                    const on = draft.paint === paint;
                    return (
                      <Pressable
                        key={paint}
                        onPress={() => setDraft(d => (d ? { ...d, paint } : d))}
                        accessibilityRole="button"
                        accessibilityLabel={
                          paint === 'text' ? 'Text color' : 'Background color'
                        }
                        accessibilityState={{ selected: on }}
                        hitSlop={4}
                        style={[styles.segmentItem, on && styles.segmentItemOn]}
                      >
                        <Icon size={18} color={on ? '#111111' : '#FFFFFF'} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

function RailButton({
  label,
  on,
  disabled,
  onPress,
  children,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      hitSlop={6}
      style={[styles.railButton, on && styles.railButtonOn]}
    >
      {children}
    </Pressable>
  );
}

function Chip({
  label,
  accessibilityLabel,
  labelStyle,
  on,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  labelStyle?: TextStyle;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: on }}
      hitSlop={4}
      style={[styles.chipButton, on && styles.chipButtonOn]}
    >
      <Text
        style={[styles.chipText, labelStyle, on && styles.chipTextOn]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Tab({
  label,
  icon: Icon,
  on,
  dot,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  on: boolean;
  dot?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      hitSlop={6}
      style={[styles.tab, on && styles.tabOn]}
    >
      <Icon size={22} color={on ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
      {dot ? <View style={[styles.tabDot, { backgroundColor: dot }]} /> : null}
    </Pressable>
  );
}

const SLIDER_HEIGHT = 200;

/** Vertical size slider on the left edge: up is bigger. */
function SizeSlider({
  label,
  value,
  min,
  max,
  preview,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  preview?: { color: string; size: number };
  onChange: (value: number) => void;
}) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const range = useRef({ min, max });
  range.current = { min, max };
  const originY = useRef(0);
  const at = (pageY: number) => {
    const p = 1 - Math.min(1, Math.max(0, (pageY - originY.current) / SLIDER_HEIGHT));
    changeRef.current(range.current.min + p * (range.current.max - range.current.min));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        originY.current = e.nativeEvent.pageY - e.nativeEvent.locationY;
        at(e.nativeEvent.pageY);
      },
      onPanResponderMove: e => at(e.nativeEvent.pageY),
    }),
  ).current;
  const p = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const dot = Math.max(6, preview?.size ?? 0);

  return (
    <View style={styles.slider} pointerEvents="box-none">
      <View
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        style={styles.sliderHit}
      >
        <Svg width={36} height={SLIDER_HEIGHT} pointerEvents="none">
          <Polygon
            points={`8,0 28,0 18,${SLIDER_HEIGHT}`}
            fill="rgba(255,255,255,0.5)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </Svg>
        <View
          pointerEvents="none"
          style={[styles.sliderThumb, { top: (1 - p) * SLIDER_HEIGHT - 12 }]}
        />
      </View>
      {preview ? (
        <View
          pointerEvents="none"
          style={[
            styles.sizePreview,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: preview.color,
              top: (1 - p) * SLIDER_HEIGHT - dot / 2,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function Stroke({
  points: pts,
  color,
  width,
  brush,
}: {
  points: number[];
  color: string;
  width: number;
  brush: StoryBrush;
}) {
  const points = pairs(pts);
  if (brush === 'arrow') {
    return (
      <G>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polygon points={arrowHead(pts, width)} fill={color} />
      </G>
    );
  }
  if (brush === 'marker') {
    return (
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={width * 2.2}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    );
  }
  if (brush === 'neon') {
    return (
      <G>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeOpacity={0.45}
          strokeWidth={width * 2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polyline
          points={points}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={Math.max(1, width * 0.7)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    );
  }
  return (
    <Polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function contrast(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#000000' : '#FFFFFF';
}

const SWATCH = 30;
const SWATCH_GAP = 12;

const HUES = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

function ColorRow({
  value,
  onPick,
}: {
  value: string;
  onPick: (color: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = Math.max(1, Math.floor((width + SWATCH_GAP) / (SWATCH + SWATCH_GAP)));
  const pages: string[][] = [];
  for (let i = 0; i < STORY_COLORS.length; i += perPage)
    pages.push(STORY_COLORS.slice(i, i + perPage));

  return (
    <View style={styles.colorBar}>
      <Pressable
        onPress={() => setCustom(c => !c)}
        accessibilityRole="button"
        accessibilityLabel={custom ? 'Show color presets' : 'Pick a custom color'}
        hitSlop={4}
        style={[styles.swatch, styles.swatchBig, custom && styles.swatchOn]}
      >
        {custom ? (
          <View style={[styles.fillRound, { backgroundColor: value }]} />
        ) : (
          <RainbowDot size={SWATCH} />
        )}
      </Pressable>
      {custom ? (
        <Spectrum value={value} onPick={onPick} />
      ) : (
        <View
          style={styles.pages}
          onLayout={e => setWidth(e.nativeEvent.layout.width)}
        >
          {width ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              onMomentumScrollEnd={e =>
                setPage(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {pages.map((colors, i) => (
                <View key={i} style={[styles.page, { width }]}>
                  {colors.map(color => (
                    <Pressable
                      key={color}
                      onPress={() => onPick(color)}
                      accessibilityRole="button"
                      accessibilityLabel={`Color ${color}`}
                      accessibilityState={{ selected: color === value }}
                      hitSlop={4}
                      style={[
                        styles.swatch,
                        { backgroundColor: color },
                        color === value && styles.swatchOn,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : null}
          {pages.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {pages.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function RainbowDot({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <LinearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
          {HUES.map((hue, i) => (
            <Stop key={i} offset={i / (HUES.length - 1)} stopColor={hue} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width={size} height={size} rx={size / 2} fill="url(#rainbow)" />
    </Svg>
  );
}

function Spectrum({
  value,
  onPick,
}: {
  value: string;
  onPick: (color: string) => void;
}) {
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const pick = (h: number, l: number) => {
    setHsl({ h, l });
    onPick(hslToHex(h, 1, l));
  };
  return (
    <View style={styles.spectrum}>
      <GradientBar
        id="hue"
        label="Color"
        stops={HUES}
        position={hsl.h / 360}
        thumb={hslToHex(hsl.h, 1, 0.5)}
        onChange={p => pick(p * 359, hsl.l === 0 || hsl.l === 1 ? 0.5 : hsl.l)}
      />
      <GradientBar
        id="light"
        label="Shade"
        stops={['#000000', hslToHex(hsl.h, 1, 0.5), '#FFFFFF']}
        position={hsl.l}
        thumb={value}
        onChange={p => pick(hsl.h, p)}
      />
    </View>
  );
}

function GradientBar({
  id,
  label,
  stops,
  position,
  thumb,
  onChange,
}: {
  id: string;
  label: string;
  stops: string[];
  position: number;
  thumb: string;
  onChange: (position: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(width);
  widthRef.current = width;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const originX = useRef(0);
  const at = (pageX: number) =>
    changeRef.current(
      Math.min(1, Math.max(0, (pageX - originX.current) / widthRef.current)),
    );
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        originX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        at(e.nativeEvent.pageX);
      },
      onPanResponderMove: e => at(e.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      style={styles.bar}
    >
      <Svg width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            {stops.map((color, i) => (
              <Stop key={i} offset={i / (stops.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={12} fill={`url(#${id})`} />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left: position * width - 12, backgroundColor: thumb },
        ]}
      />
    </View>
  );
}

function textShadow(color: string) {
  return {
    textShadowColor:
      color.toUpperCase() === '#000000'
        ? 'rgba(255,255,255,0.6)'
        : 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  };
}

function toUnit(points: number[], w: number, h: number) {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push(
      Math.min(1, Math.max(0, points[i]! / Math.max(1, w))),
      Math.min(1, Math.max(0, points[i + 1]! / Math.max(1, h))),
    );
  }
  return out.slice(0, 160);
}

function pairs(points: number[]) {
  const out: string[] = [];
  for (let i = 0; i < points.length; i += 2)
    out.push(`${points[i]},${points[i + 1]}`);
  return out.join(' ');
}

function toPx(points: number[], size: Size) {
  return points.map((v, i) => v * (i % 2 ? size.h : size.w));
}

/** Triangle at the end of the stroke, pointing along its last few pixels. */
function arrowHead(points: number[], width: number) {
  const n = points.length;
  if (n < 4) return '';
  const tipX = points[n - 2]!;
  const tipY = points[n - 1]!;
  let i = n - 4;
  while (i > 0 && Math.hypot(tipX - points[i]!, tipY - points[i + 1]!) < 12) i -= 2;
  const angle = Math.atan2(tipY - points[i + 1]!, tipX - points[i]!);
  const len = Math.max(14, width * 4);
  const spreadAngle = Math.PI / 7;
  const corner = (a: number) =>
    `${tipX - len * Math.cos(a)},${tipY - len * Math.sin(a)}`;
  return `${tipX},${tipY} ${corner(angle - spreadAngle)} ${corner(angle + spreadAngle)}`;
}

/**
 * Left/right-aligned text is anchored by that edge, so it stays against the
 * screen edge as it grows. Scaling happens around the center, hence the offset.
 */
function anchorLeft(item: Placed, stageW: number, boxW: number) {
  const x = item.x * stageW;
  const align = item.type === 'text' ? (item.align ?? 'center') : 'center';
  const grow = (boxW * ((item.scale || 1) - 1)) / 2;
  if (align === 'left') return x + grow;
  if (align === 'right') return x - boxW - grow;
  return x - boxW / 2;
}

const clamp = (v: number) => Math.min(0.95, Math.max(0.05, v));
const clampScale = (v: number) => Math.min(3, Math.max(0.4, v));
const wrapAngle = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

type Touch = { pageX: number; pageY: number };
const spread = (a: Touch, b: Touch) => ({
  dist: Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY),
  angle: (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI,
});

function OverlayView({
  item,
  stage,
  editable,
  fading,
  isOverTrash,
  onMove,
  onTransform,
  onTap,
  onDrag,
  onDrop,
  onVote,
  onReply,
}: {
  item: Placed;
  stage: Size;
  editable: boolean;
  fading: boolean;
  isOverTrash: (x: number, y: number) => boolean;
  onMove: (x: number, y: number) => void;
  onTransform: (scale: number, rotation: number) => void;
  onTap: () => void;
  onDrag: (overTrash: boolean) => void;
  onDrop: (overTrash: boolean) => void;
  onVote: (option: number) => void;
  onReply: () => void;
}) {
  const [box, setBox] = useState<Size | null>(null);
  const start = useRef({ x: item.x, y: item.y });
  const moving = useRef(false);
  const dragged = useRef(false);
  const pinch = useRef<{
    dist: number;
    angle: number;
    scale: number;
    rotation: number;
  } | null>(null);
  const live = useRef({ item, stage, editable, isOverTrash, onMove, onTransform, onTap, onDrag, onDrop });
  live.current = { item, stage, editable, isOverTrash, onMove, onTransform, onTap, onDrag, onDrop };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => live.current.editable,
      onMoveShouldSetPanResponder: () => live.current.editable,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = { x: live.current.item.x, y: live.current.item.y };
        moving.current = false;
        dragged.current = false;
        pinch.current = null;
      },
      onPanResponderMove: (evt, g) => {
        const l = live.current;
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const now = spread(touches[0]!, touches[1]!);
          moving.current = true;
          if (!pinch.current) {
            pinch.current = { ...now, scale: l.item.scale, rotation: l.item.rotation };
            return;
          }
          const p = pinch.current;
          l.onTransform(
            clampScale(p.scale * (now.dist / Math.max(1, p.dist))),
            wrapAngle(p.rotation + now.angle - p.angle),
          );
          return;
        }
        if (pinch.current) {
          pinch.current = null;
          start.current = {
            x: l.item.x - g.dx / Math.max(1, l.stage.w),
            y: l.item.y - g.dy / Math.max(1, l.stage.h),
          };
          return;
        }
        if (!moving.current && Math.abs(g.dx) + Math.abs(g.dy) < 6) return;
        moving.current = true;
        dragged.current = true;
        l.onMove(
          clamp(start.current.x + g.dx / Math.max(1, l.stage.w)),
          clamp(start.current.y + g.dy / Math.max(1, l.stage.h)),
        );
        l.onDrag(l.isOverTrash(evt.nativeEvent.pageX, evt.nativeEvent.pageY));
      },
      onPanResponderRelease: evt => {
        const l = live.current;
        pinch.current = null;
        if (!moving.current) {
          l.onTap();
          return;
        }
        moving.current = false;
        l.onDrop(
          dragged.current &&
            l.isOverTrash(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
        );
      },
      onPanResponderTerminate: () => {
        if (moving.current) live.current.onDrop(false);
        moving.current = false;
        pinch.current = null;
      },
    }),
  ).current;

  return (
    <View
      {...(editable ? pan.panHandlers : {})}
      pointerEvents={
        editable || ['poll', 'question', 'quiz', 'link'].includes(item.type)
          ? 'auto'
          : 'none'
      }
      onLayout={e =>
        setBox({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
      style={[
        styles.chip,
        {
          maxWidth: stage.w - 32,
          left: anchorLeft(item, stage.w, box?.w ?? 0),
          top: item.y * stage.h - (box?.h ?? 0) / 2,
          opacity: box ? (fading ? 0.4 : 1) : 0,
          transform: [
            { scale: (item.scale || 1) * (fading ? 0.6 : 1) },
            { rotate: `${item.rotation || 0}deg` },
          ],
        },
      ]}
    >
      <OverlayBody item={item} onVote={onVote} onReply={onReply} />
    </View>
  );
}

function OverlayBody({
  item,
  onVote,
  onReply,
}: {
  item: Placed;
  onVote: (option: number) => void;
  onReply: () => void;
}) {
  if (item.type === 'text') {
    return (
      <Text
        style={[
          styles.text,
          FONTS[item.font ?? 'classic'].style,
          item.background
            ? [styles.textBoxed, { backgroundColor: item.background }]
            : textShadow(item.color),
          { color: item.color, textAlign: item.align ?? 'center' },
        ]}
      >
        {item.text}
      </Text>
    );
  }
  if (item.type === 'location') {
    return (
      <View style={styles.location}>
        <MapPin size={16} color="#111111" />
        <Text style={styles.locationText} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    );
  }
  if (item.type === 'sticker')
    return <Text style={styles.emoji}>{item.emoji}</Text>;
  if (item.type === 'poll') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.question}</Text>
        {item.options.map((option, i) => (
          <Pressable
            key={`${option}-${i}`}
            onPress={() => onVote(i)}
            accessibilityRole="button"
          >
            <Text style={styles.option}>
              {option}
              {item.votes ? ` · ${item.votes[i] ?? 0}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }
  if (item.type === 'question') {
    return (
      <Pressable
        onPress={onReply}
        accessibilityRole="button"
        style={styles.card}
      >
        <Text style={styles.cardTitle}>{item.prompt}</Text>
        <Text style={styles.option}>Answer</Text>
      </Pressable>
    );
  }
  if (item.type === 'quiz') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.question}</Text>
        {item.options.map((option, i) => (
          <Pressable
            key={`${option}-${i}`}
            onPress={() =>
              Alert.alert(i === item.answer ? 'Correct' : 'Not quite')
            }
            accessibilityRole="button"
          >
            <Text style={styles.option}>{option}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  if (item.type === 'countdown') {
    const left = new Date(item.ends_at).getTime() - Date.now();
    const hours = Math.max(0, Math.floor(left / 3600000));
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.option}>{hours}h left</Text>
      </View>
    );
  }
  if (item.type === 'link') {
    return (
      <Pressable
        onPress={() => Linking.openURL(item.url).catch(() => {})}
        accessibilityRole="link"
      >
        <Text style={styles.text}>{item.label}</Text>
      </Pressable>
    );
  }
  if (item.type === 'hashtag')
    return <Text style={styles.text}>#{item.tag}</Text>;
  return <Text style={styles.text}>@{item.username}</Text>;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  chip: { position: 'absolute', padding: 8 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipButton: {
    minWidth: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipButtonOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  chipTextOn: { color: '#111111' },
  slider: { height: SLIDER_HEIGHT, width: 120 },
  sliderWrap: { position: 'absolute', left: 8 },
  editorSlider: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -SLIDER_HEIGHT / 2,
  },
  doneIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sliderHit: { width: 36, height: SLIDER_HEIGHT },
  sliderThumb: {
    position: 'absolute',
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  sizePreview: {
    position: 'absolute',
    left: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  boxToggle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxToggleOn: { backgroundColor: '#FFFFFF' },
  boxToggleText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  boxToggleTextOn: { color: '#111111' },
  fonts: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  dock: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    gap: 10,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 48,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tabDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 6 },
  segmentItemOn: { backgroundColor: '#FFFFFF' },
  text: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 26,
    textAlign: 'center',
  },
  textBoxed: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  locationText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 15,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  emoji: { fontSize: 34 },
  card: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    padding: 10,
    minWidth: 140,
  },
  cardTitle: { color: darkScreen.text, fontWeight: '800', marginBottom: 6 },
  option: { color: '#FFFFFF', paddingVertical: 4, fontWeight: '600' },
  rail: {
    position: 'absolute',
    right: 12,
    gap: 12,
    alignItems: 'center',
  },
  drawTop: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawColors: { position: 'absolute', left: 0, right: 0 },
  railButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  railButtonOn: { backgroundColor: '#FFFFFF' },
  trashWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  trash: {
    width: TRASH_SIZE,
    height: TRASH_SIZE,
    borderRadius: TRASH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  trashOn: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    transform: [{ scale: 1.3 }],
  },
  editor: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  editorTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  editorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 56,
    paddingRight: 24,
  },
  editorInput: {
    fontSize: 26,
    fontWeight: '800',
    minWidth: 40,
    padding: 0,
    backgroundColor: 'transparent',
  },
  colorBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SWATCH_GAP,
    paddingHorizontal: 16,
  },
  pages: { flex: 1, gap: 8 },
  page: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SWATCH_GAP,
    height: SWATCH + 8,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotOn: { backgroundColor: '#FFFFFF' },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  swatchBig: { marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  fillRound: { ...StyleSheet.absoluteFill },
  spectrum: { flex: 1, gap: 12, paddingRight: 16, paddingVertical: 4 },
  bar: { height: 24, justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  swatchOn: { transform: [{ scale: 1.25 }], borderWidth: 3 },
});
