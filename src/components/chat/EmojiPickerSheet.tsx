import {
  Car,
  Check,
  Clock,
  Flag,
  Heart,
  Lightbulb,
  type LucideIcon,
  PawPrint,
  Search,
  Smile,
  Trophy,
  Utensils,
  X,
} from 'lucide-react-native';
import {
  type ComponentRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import {
  DEFAULT_REACTIONS,
  reactionPrefs,
  useReactionPrefs,
} from '@/features/chats/reactionPrefs';
import { useAppTheme } from '@/theme';

import {
  EMOJI_CATEGORIES,
  type EmojiCategoryKey,
  searchEmojis,
} from './emojiData';

const COLUMNS = 8;
const HEADER_HEIGHT = 38;
const SHEET_HEIGHT = 0.72;
/** Build the picker this long after the chat opens, so the chat itself opens fast. */
const PREWARM_MS = 900;

type SectionKey = 'yours' | 'recent' | 'search' | EmojiCategoryKey;
type Row =
  | { kind: 'header'; key: string; section: SectionKey; title: string }
  | { kind: 'emojis'; key: string; section: SectionKey; emojis: string[] };

const TABS: { key: SectionKey; Icon: LucideIcon; label: string }[] = [
  { key: 'recent', Icon: Clock, label: 'Recent' },
  { key: 'smileys', Icon: Smile, label: 'Smileys & people' },
  { key: 'animals', Icon: PawPrint, label: 'Animals & nature' },
  { key: 'food', Icon: Utensils, label: 'Food & drink' },
  { key: 'activities', Icon: Trophy, label: 'Activities' },
  { key: 'travel', Icon: Car, label: 'Travel & places' },
  { key: 'objects', Icon: Lightbulb, label: 'Objects' },
  { key: 'symbols', Icon: Heart, label: 'Symbols' },
  { key: 'flags', Icon: Flag, label: 'Flags' },
];

function chunk(list: readonly string[], size: number) {
  const out: string[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function section(key: SectionKey, title: string, emojis: readonly string[]): Row[] {
  if (!emojis.length) return [];
  return [
    { kind: 'header', key: `h:${key}`, section: key, title },
    ...chunk(emojis, COLUMNS).map((row, i) => ({
      kind: 'emojis' as const,
      key: `r:${key}:${i}`,
      section: key,
      emojis: row,
    })),
  ];
}

/** Rows for the picker grid; exported for tests. */
export function buildPickerRows(opts: {
  query: string;
  quick: readonly string[];
  recent: readonly string[];
  includeQuick: boolean;
}): Row[] {
  if (opts.query.trim()) {
    return section('search', 'Results', searchEmojis(opts.query));
  }
  return [
    ...(opts.includeQuick ? section('yours', 'Your reactions', opts.quick) : []),
    ...section('recent', 'Recent', opts.recent),
    ...EMOJI_CATEGORIES.flatMap(c =>
      section(
        c.key,
        c.title,
        c.emojis.map(e => e.emoji),
      ),
    ),
  ];
}

/** Puts `emoji` in `slot`; if it's already elsewhere in the list the two swap, so there are no duplicates. */
export function placeInSlot(list: readonly string[], slot: number, emoji: string) {
  const next = [...list];
  const existing = next.indexOf(emoji);
  if (existing >= 0 && existing !== slot) next[existing] = next[slot]!;
  next[slot] = emoji;
  return next;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** A reaction was chosen (the sheet closes itself). */
  onPick: (emoji: string) => void;
  /** My reaction on the message, highlighted. */
  current: string | null;
};

/** Full emoji picker for reactions, with "Your reactions" customisation (Instagram-style). */
export function EmojiPickerSheet({ visible, onClose, onPick, current }: Props) {
  const { colors, scheme } = useAppTheme();
  const { width } = useWindowDimensions();
  const prefs = useReactionPrefs();
  const [query, setQuery] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [slot, setSlot] = useState(0);
  const [activeTab, setActiveTab] = useState<SectionKey>('recent');
  const listRef = useRef<ComponentRef<typeof FlatList<Row>>>(null);
  const cell = Math.floor((width - 16) / COLUMNS);

  const rows = useMemo(
    () =>
      buildPickerRows({
        query,
        quick: prefs.quick,
        recent: prefs.recent,
        includeQuick: !customizing,
      }),
    [query, prefs.quick, prefs.recent, customizing],
  );
  const offsets = useMemo(() => {
    let y = 0;
    return rows.map(r => {
      const length = r.kind === 'header' ? HEADER_HEIGHT : cell;
      const at = { length, offset: y };
      y += length;
      return at;
    });
  }, [rows, cell]);

  const reset = () => {
    setQuery('');
    setCustomizing(false);
    setSlot(0);
  };
  const close = () => {
    reset();
    onClose();
  };

  const choose = (emoji: string) => {
    if (customizing) {
      setDraft(d => placeInSlot(d, slot, emoji));
      setSlot(s => (s + 1) % prefs.quick.length);
      return;
    }
    reactionPrefs.pushRecent(emoji);
    reset();
    onPick(emoji);
  };

  const startCustomize = () => {
    setDraft([...prefs.quick]);
    setSlot(0);
    setQuery('');
    setCustomizing(true);
  };

  const save = () => {
    reactionPrefs.setQuick(draft);
    setCustomizing(false);
  };

  const jumpTo = (key: SectionKey) => {
    setQuery('');
    const index = rows.findIndex(r => r.kind === 'header' && r.section === key);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true });
  };

  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: { item: Row }[] }) => {
      const first = viewableItems[0]?.item;
      if (first && first.section !== 'search') {
        setActiveTab(first.section === 'yours' ? 'recent' : first.section);
      }
    },
  ).current;

  // Rows only re-render when their own emojis or the highlighted one change.
  const handlers = useRef({ choose, startCustomize });
  handlers.current = { choose, startCustomize };
  const onChoose = useCallback(
    (emoji: string) => handlers.current.choose(emoji),
    [],
  );
  const onCustomize = useCallback(() => handlers.current.startCustomize(), []);
  const highlighted = customizing ? null : current;
  const cellStyle = useMemo(
    () => ({ width: cell, height: cell, borderRadius: cell / 2 }),
    [cell],
  );

  const renderRow = useCallback(
    ({ item }: { item: Row }) =>
      item.kind === 'header' ? (
        <View style={[styles.header, { height: HEADER_HEIGHT }]}>
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            {item.title}
          </Text>
          {item.section === 'yours' ? (
            <Pressable
              onPress={onCustomize}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Customize
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <EmojiRow
          emojis={item.emojis}
          highlighted={
            highlighted && item.emojis.includes(highlighted) ? highlighted : null
          }
          cellStyle={cellStyle}
          highlightColor={colors.surfaceAlt}
          onChoose={onChoose}
        />
      ),
    [colors, highlighted, cellStyle, onChoose, onCustomize],
  );

  // Built once in the background shortly after the chat opens, so opening is just the slide.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (mounted) return;
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(true), PREWARM_MS);
    return () => clearTimeout(timer);
  }, [visible, mounted]);

  useEffect(() => {
    if (!visible) return;
    setActiveTab('recent');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [visible]);

  return (
    <InlineSheet
      visible={visible}
      onClose={close}
      title={customizing ? 'Customize reactions' : 'Reactions'}
      headerRight={
        customizing ? (
          <IconButton onPress={save} accessibilityLabel="Save reactions">
            <Check size={22} color={colors.primary} />
          </IconButton>
        ) : (
          <IconButton onPress={close} accessibilityLabel="Close">
            <X size={22} color={colors.text} />
          </IconButton>
        )
      }
    >
      {customizing ? (
        <View style={[styles.custom, { borderBottomColor: colors.border }]}>
          <View style={styles.slots}>
            {draft.map((emoji, i) => (
              <Pressable
                key={`${i}`}
                onPress={() => setSlot(i)}
                accessibilityRole="button"
                accessibilityLabel={`Reaction ${i + 1}: ${emoji}`}
                accessibilityState={{ selected: slot === i }}
                style={[
                  styles.slot,
                  { backgroundColor: colors.surfaceAlt },
                  slot === i && { borderColor: colors.primary },
                ]}
              >
                <Text style={styles.emoji} allowFontScaling={false}>
                  {emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap a reaction, then pick an emoji to replace it.
          </Text>
          <View style={styles.customActions}>
            <Pressable
              onPress={() => setDraft([...DEFAULT_REACTIONS])}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.link, { color: colors.primary }]}>
                Reset to default
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCustomizing(false)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.link, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={[styles.search, { backgroundColor: colors.inputBackground }]}>
        <Search size={17} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search emoji"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          keyboardAppearance={scheme}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search emoji"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {mounted ? (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderRow}
          getItemLayout={(_, index) => ({ ...offsets[index]!, index })}
          onViewableItemsChanged={onViewable}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          removeClippedSubviews
          style={styles.flex}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No emoji found
            </Text>
          }
        />
      ) : (
        <View style={styles.flex} />
      )}
      {!query ? (
        <View style={[styles.tabs, { borderTopColor: colors.border }]}>
          {TABS.map(({ key, Icon, label }) => {
            const active = activeTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => jumpTo(key)}
                hitSlop={4}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                style={styles.tab}
              >
                <Icon
                  size={20}
                  color={active ? colors.text : colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </InlineSheet>
  );
}

/**
 * Bottom sheet drawn inside the screen instead of a Modal, so its content can stay
 * mounted while hidden. Lifts itself above the keyboard (the app is edge-to-edge).
 */
function InlineSheet({
  visible,
  onClose,
  title,
  headerRight,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  headerRight: ReactNode;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const sheetHeight = Math.round(height * SHEET_HEIGHT);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, e => setKeyboard(e.endCoordinates.height)),
      Keyboard.addListener(hide, () => setKeyboard(0)),
    ];
    return () => subs.forEach(s => s.remove());
  }, []);

  const lift = visible ? keyboard : 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.overlay, opacity: progress },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            height: Math.min(sheetHeight, height - lift - insets.top - 24),
            bottom: lift,
            paddingBottom: lift ? undefined : insets.bottom,
            backgroundColor: colors.surfaceElevated,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sheetHeight + insets.bottom + 40, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={[styles.sheetHead, { borderBottomColor: colors.border }]}>
          <Text
            style={[styles.sheetTitle, { color: colors.text }]}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.sheetRight}>{headerRight}</View>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const keyOf = (r: Row) => r.key;

const EmojiRow = memo(function EmojiRowView({
  emojis,
  highlighted,
  cellStyle,
  highlightColor,
  onChoose,
}: {
  emojis: string[];
  highlighted: string | null;
  cellStyle: { width: number; height: number; borderRadius: number };
  highlightColor: string;
  onChoose: (emoji: string) => void;
}) {
  return (
    <View style={styles.row}>
      {emojis.map(emoji => (
        <Pressable
          key={emoji}
          onPress={() => onChoose(emoji)}
          accessibilityRole="button"
          accessibilityLabel={emoji}
          android_ripple={{ color: highlightColor, borderless: true }}
          style={[
            styles.cell,
            cellStyle,
            highlighted === emoji && { backgroundColor: highlightColor },
          ]}
        >
          <Text style={styles.emoji} allowFontScaling={false}>
            {emoji}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHead: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetRight: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 8, paddingBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  headerText: { fontSize: 13, fontWeight: '700' },
  link: { fontSize: 13.5, fontWeight: '700' },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28, lineHeight: 34 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 14 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { padding: 6 },
  custom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  slots: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  hint: { fontSize: 12.5, textAlign: 'center' },
  customActions: { flexDirection: 'row', justifyContent: 'space-between' },
});
