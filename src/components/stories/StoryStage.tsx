import { useRef, useState } from 'react';
import {
  Alert,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import {
  overlayId,
  placed,
  STICKERS,
  type StoryOverlay,
} from '@/features/stories/overlay';
import { darkScreen } from '@/theme';

type Props = {
  overlays: StoryOverlay[];
  editable?: boolean;
  onChange?: (next: StoryOverlay[]) => void;
  onVote?: (overlayId: string, option: number) => void;
  onReply?: (overlayId: string) => void;
  onTagPeople?: () => void;
};

const TOOLS = [
  'Text',
  'Draw',
  'Poll',
  'Question',
  'Quiz',
  'Countdown',
  'Link',
  'Tag',
] as const;

/** Text, stickers, drawing and interactive stickers, saved with the story. */
export function StoryStage({
  overlays,
  editable,
  onChange,
  onVote,
  onReply,
  onTagPeople,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draw, setDraw] = useState(false);
  const [draftStroke, setDraftStroke] = useState<number[]>([]);
  const [prompt, setPrompt] = useState<{
    title: string;
    onText: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const stroke = useRef<number[]>([]);
  const sizeRef = useRef({ w: 1, h: 1 });
  const drawOn = useRef(false);
  drawOn.current = draw;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const add = (overlay: StoryOverlay) => {
    const current = overlaysRef.current;
    if (current.length >= 12) {
      Alert.alert('That story already has 12 stickers.');
      return;
    }
    onChangeRef.current?.([...current, overlay]);
    setSelected(overlay.id);
    setDraw(false);
  };

  const ask = (title: string, onText: (value: string) => void) => {
    setPromptValue('');
    setPrompt({ title, onText });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawOn.current,
      onMoveShouldSetPanResponder: () => drawOn.current,
      onPanResponderGrant: evt => {
        const point = [evt.nativeEvent.locationX, evt.nativeEvent.locationY];
        stroke.current = point;
        setDraftStroke(point);
      },
      onPanResponderMove: evt => {
        const next = [
          ...stroke.current,
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY,
        ].slice(-200);
        stroke.current = next;
        setDraftStroke(next);
      },
      onPanResponderRelease: () => {
        const size = sizeRef.current;
        const points = toUnit(stroke.current, size.w, size.h);
        if (points.length >= 4) {
          add({
            id: overlayId(),
            type: 'draw',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            color: '#FFFFFF',
            points,
          });
        }
        stroke.current = [];
        setDraftStroke([]);
      },
    }),
  ).current;

  const onTool = (tool: (typeof TOOLS)[number]) => {
    if (tool === 'Draw') {
      setDraw(d => !d);
      setSelected(null);
      return;
    }
    setDraw(false);
    if (tool === 'Tag') {
      onTagPeople?.();
      return;
    }
    if (tool === 'Text') {
      ask('Text', text =>
        add(
          placed({
            id: overlayId(),
            type: 'text',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            text,
            color: '#FFFFFF',
            background: '#000000',
          }),
        ),
      );
      return;
    }
    if (tool === 'Poll') {
      ask('Poll question', question =>
        add(
          placed({
            id: overlayId(),
            type: 'poll',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            question,
            options: ['Yes', 'No'],
            votes: [0, 0],
          }),
        ),
      );
      return;
    }
    if (tool === 'Question') {
      ask('Question', promptText =>
        add(
          placed({
            id: overlayId(),
            type: 'question',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            prompt: promptText,
          }),
        ),
      );
      return;
    }
    if (tool === 'Quiz') {
      ask('Quiz question', question =>
        add(
          placed({
            id: overlayId(),
            type: 'quiz',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            question,
            options: ['A', 'B'],
            answer: 0,
          }),
        ),
      );
      return;
    }
    if (tool === 'Countdown') {
      ask('Countdown title', title =>
        add(
          placed({
            id: overlayId(),
            type: 'countdown',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            title,
            ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        ),
      );
      return;
    }
    if (tool === 'Link') {
      ask('https:// link', url => {
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        add(
          placed({
            id: overlayId(),
            type: 'link',
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            label: 'Link',
            url: href,
          }),
        );
      });
    }
  };

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <View
        style={styles.fill}
        pointerEvents={draw ? 'auto' : 'box-none'}
        onLayout={e => {
          sizeRef.current = {
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          };
        }}
        {...(draw ? pan.panHandlers : {})}
      >
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          pointerEvents="none"
        >
          {overlays
            .filter(item => item.type === 'draw')
            .map(item => (
              <Polyline
                key={item.id}
                points={unitPolyline(item.points)}
                fill="none"
                stroke={item.color}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
        </Svg>
        {overlays
          .filter(item => item.type !== 'draw')
          .map(item => (
            <OverlayView
              key={item.id}
              item={item}
              editable={!!editable}
              selected={selected === item.id}
              onSelect={() => editable && setSelected(item.id)}
              onMove={(x, y) =>
                onChange?.(
                  overlays.map(row =>
                    row.id === item.id ? { ...row, x, y } : row,
                  ),
                )
              }
              onVote={option => onVote?.(item.id, option)}
              onReply={() => onReply?.(item.id)}
            />
          ))}
        {draftStroke.length >= 4 ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polyline
              points={pairsPx(draftStroke)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
      </View>
      {editable ? (
        <View style={styles.tools}>
          {selected ? (
            <Pressable
              onPress={() => {
                onChange?.(overlays.filter(item => item.id !== selected));
                setSelected(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.tool}>Delete</Text>
            </Pressable>
          ) : null}
          {TOOLS.map(tool => (
            <Pressable
              key={tool}
              onPress={() => onTool(tool)}
              accessibilityRole="button"
            >
              <Text
                style={[styles.tool, draw && tool === 'Draw' && styles.toolOn]}
              >
                {tool}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {editable ? (
        <View style={styles.stickers}>
          {STICKERS.map(emoji => (
            <Pressable
              key={emoji}
              onPress={() =>
                add(
                  placed({
                    id: overlayId(),
                    type: 'sticker',
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    emoji,
                  }),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={emoji}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {prompt ? (
        <View style={styles.prompt}>
          <Text style={styles.promptTitle}>{prompt.title}</Text>
          <TextInput
            value={promptValue}
            onChangeText={setPromptValue}
            autoFocus
            placeholder={prompt.title}
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.promptInput}
          />
          <View style={styles.promptRow}>
            <Pressable
              onPress={() => setPrompt(null)}
              accessibilityRole="button"
            >
              <Text style={styles.tool}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const value = promptValue.trim();
                if (value) prompt.onText(value);
                setPrompt(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.toolOn}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
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

function pairsPx(points: number[]) {
  const out: string[] = [];
  for (let i = 0; i < points.length; i += 2)
    out.push(`${points[i]},${points[i + 1]}`);
  return out.join(' ');
}

function unitPolyline(points: number[]) {
  const out: string[] = [];
  for (let i = 0; i < points.length; i += 2)
    out.push(`${points[i]! * 100},${points[i + 1]! * 100}`);
  return out.join(' ');
}

function OverlayView({
  item,
  editable,
  selected,
  onSelect,
  onMove,
  onVote,
  onReply,
}: {
  item: Exclude<StoryOverlay, { type: 'draw' }>;
  editable: boolean;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onVote: (option: number) => void;
  onReply: () => void;
}) {
  const start = useRef({ x: item.x, y: item.y });
  const itemRef = useRef(item);
  itemRef.current = item;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onPanResponderGrant: () => {
        start.current = { x: itemRef.current.x, y: itemRef.current.y };
        selectRef.current();
      },
      onPanResponderMove: (_evt, g) => {
        moveRef.current(
          Math.min(0.92, Math.max(0.08, start.current.x + g.dx / 280)),
          Math.min(0.88, Math.max(0.1, start.current.y + g.dy / 520)),
        );
      },
    }),
  ).current;

  return (
    <View
      {...(editable ? pan.panHandlers : {})}
      style={[
        styles.chip,
        {
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          borderColor: selected ? '#FFFFFF' : 'transparent',
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
  item: Exclude<StoryOverlay, { type: 'draw' }>;
  onVote: (option: number) => void;
  onReply: () => void;
}) {
  if (item.type === 'text') {
    return (
      <Text
        style={[
          styles.text,
          {
            color: item.color,
            backgroundColor: item.background ?? 'transparent',
          },
        ]}
      >
        {item.text}
      </Text>
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
  chip: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
    transform: [{ translateX: -50 }, { translateY: -18 }],
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
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
  tools: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 118,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
  },
  tool: {
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  toolOn: {
    color: '#111111',
    fontWeight: '800',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  stickers: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 78,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 12,
  },
  prompt: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 80,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  promptTitle: { color: '#FFFFFF', fontWeight: '800' },
  promptInput: {
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    padding: 10,
  },
  promptRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
