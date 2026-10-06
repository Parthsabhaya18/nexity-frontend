import { CloudOff, Search, Sticker, X } from 'lucide-react-native';
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
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { MediaGridSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { type GifItem, type GifKind, chatApi } from '@/services/api/chat';
import { ApiError } from '@/services/api/client';
import { radius, useAppTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';

const SEARCH_DEBOUNCE_MS = 350;
const GAP = 6;
const PADDING = 10;
const STICKER_COLUMNS = 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (gif: GifItem, kind: GifKind) => void;
};

type State = {
  items: GifItem[];
  cursor: string | null;
  loading: boolean;
  error: string | null;
};

const INITIAL: State = { items: [], cursor: null, loading: false, error: null };

const COPY: Record<GifKind, { search: string; noun: string }> = {
  gif: { search: 'Search GIPHY', noun: 'GIFs' },
  sticker: { search: 'Search GIPHY stickers', noun: 'stickers' },
};

function errorText(err: unknown) {
  if (err instanceof ApiError && err.code === 'GIFS_NOT_CONFIGURED') {
    return "GIFs and stickers aren't available yet. Please try again later.";
  }
  return 'Check your connection and try again.';
}

/** GIPHY picker with Stickers / GIF tabs. Tapping an item sends it straight away. */
export function GifSheet({ visible, onClose, onPick }: Props) {
  const { scheme, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<GifKind>('gif');
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [state, setState] = useState<State>(INITIAL);
  const request = useRef(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const gifColumn = (width - PADDING * 2 - GAP) / 2;
  const stickerCell =
    (width - PADDING * 2 - GAP * (STICKER_COLUMNS - 1)) / STICKER_COLUMNS;

  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(
    async (k: GifKind, q: string, cursor: string | null) => {
      const id = cursor ? request.current : ++request.current;
      setState(s => ({ ...(cursor ? s : INITIAL), loading: true, error: null }));
      try {
        const page = await chatApi.gifs(q, cursor, k);
        if (id !== request.current) return;
        setState(s => {
          const seen = new Set(cursor ? s.items.map(g => g.id) : []);
          const fresh = page.data.filter(g => !seen.has(g.id));
          return {
            items: cursor ? [...s.items, ...fresh] : fresh,
            cursor: page.pagination.next_cursor,
            loading: false,
            error: null,
          };
        });
      } catch (err) {
        if (id !== request.current) return;
        setState(s => ({ ...s, loading: false, error: errorText(err) }));
      }
    },
    [],
  );

  useEffect(() => {
    if (visible) load(kind, term, null);
  }, [visible, kind, term, load]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setTerm('');
      setKind('gif');
    }
  }, [visible]);

  const switchTo = (next: GifKind) => {
    if (next === kind) {
      scroller.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setState(INITIAL);
    setKind(next);
  };

  // Masonry: each GIF goes to the shorter column.
  const columns = useMemo(() => {
    const cols: [GifItem[], GifItem[]] = [[], []];
    const heights = [0, 0];
    for (const gif of state.items) {
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push(gif);
      heights[target] += (gifColumn * gif.height) / gif.width + GAP;
    }
    return cols;
  }, [state.items, gifColumn]);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearEnd =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;
    if (nearEnd && state.cursor && !state.loading && !state.error) {
      load(kind, term, state.cursor);
    }
  };

  const copy = COPY[kind];

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.8}>
      <View
        style={[
          styles.search,
          { backgroundColor: colors.inputBackground, borderColor: colors.border },
        ]}
      >
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={copy.search}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          keyboardAppearance={scheme}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel={copy.search}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        {state.error && !state.items.length ? (
          <View style={styles.center}>
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title={`Couldn't load ${copy.noun}`}
              text={state.error}
            />
          </View>
        ) : !state.items.length && (state.loading || !visible) ? (
          <View style={styles.grid}>
            <MediaGridSkeleton
              columns={kind === 'sticker' ? STICKER_COLUMNS : 2}
              size={kind === 'sticker' ? stickerCell : gifColumn}
              gap={GAP}
              rounded={10}
            />
          </View>
        ) : !state.items.length ? (
          <View style={styles.center}>
            <EmptyState
              icon={<Search size={34} color={colors.primary} />}
              title={`No ${copy.noun} found`}
              text={`Nothing matches "${term}". Try another word.`}
            />
          </View>
        ) : (
          <ScrollView
            ref={scroller}
            contentContainerStyle={styles.grid}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={onScroll}
            scrollEventThrottle={100}
          >
            {kind === 'sticker' ? (
              <View style={styles.stickerGrid}>
                {state.items.map(item => (
                  <StickerTile
                    key={item.id}
                    sticker={item}
                    size={stickerCell}
                    onPick={s => onPick(s, 'sticker')}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.columns}>
                {columns.map((list, i) => (
                  <View key={i} style={{ width: gifColumn, gap: GAP }}>
                    {list.map(gif => (
                      <GifTile
                        key={gif.id}
                        gif={gif}
                        width={gifColumn}
                        onPick={g => onPick(g, 'gif')}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
            {state.loading ? (
              <View style={styles.more}>
                <MediaGridSkeleton
                  columns={kind === 'sticker' ? STICKER_COLUMNS : 2}
                  count={kind === 'sticker' ? STICKER_COLUMNS : 2}
                  size={kind === 'sticker' ? stickerCell : gifColumn}
                  gap={GAP}
                  rounded={10}
                />
              </View>
            ) : null}
            <Text style={[styles.attribution, { color: colors.textSecondary }]}>
              Powered by GIPHY
            </Text>
          </ScrollView>
        )}
      </View>

      <View style={[styles.tabs, { borderTopColor: colors.border }]}>
        <TabButton
          active={kind === 'sticker'}
          label="Stickers"
          onPress={() => switchTo('sticker')}
        >
          <Sticker
            size={24}
            color={kind === 'sticker' ? colors.text : colors.textSecondary}
          />
        </TabButton>
        <TabButton
          active={kind === 'gif'}
          label="GIFs"
          onPress={() => switchTo('gif')}
        >
          <View
            style={[
              styles.gifBadge,
              {
                borderColor: kind === 'gif' ? colors.text : colors.textSecondary,
                backgroundColor: kind === 'gif' ? colors.text : undefined,
              },
            ]}
          >
            <Text
              style={[
                styles.gifBadgeText,
                { color: kind === 'gif' ? colors.surfaceElevated : colors.textSecondary },
              ]}
              allowFontScaling={false}
            >
              GIF
            </Text>
          </View>
        </TabButton>
      </View>
    </BottomSheet>
  );
}

function TabButton({
  active,
  label,
  onPress,
  children,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      {children}
      <View
        style={[
          styles.tabIndicator,
          { backgroundColor: active ? colors.text : undefined },
        ]}
      />
    </Pressable>
  );
}

const GifTile = memo(function Tile({
  gif,
  width,
  onPick,
}: {
  gif: GifItem;
  width: number;
  onPick: (gif: GifItem) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => onPick(gif)}
      accessibilityRole="button"
      accessibilityLabel={gif.title ? `Send GIF: ${gif.title}` : 'Send GIF'}
      style={({ pressed }) => [
        styles.tile,
        {
          width,
          height: (width * gif.height) / gif.width,
          backgroundColor: colors.surfaceAlt,
        },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: gif.preview_url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        fadeDuration={0}
      />
    </Pressable>
  );
});

const StickerTile = memo(function Tile({
  sticker,
  size,
  onPick,
}: {
  sticker: GifItem;
  size: number;
  onPick: (sticker: GifItem) => void;
}) {
  return (
    <Pressable
      onPress={() => onPick(sticker)}
      accessibilityRole="button"
      accessibilityLabel={
        sticker.title ? `Send sticker: ${sticker.title}` : 'Send sticker'
      }
      style={({ pressed }) => [
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: sticker.url }}
        style={styles.stickerImage}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  search: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: PADDING,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  grid: { paddingHorizontal: PADDING, paddingBottom: 12 },
  columns: { flexDirection: 'row', gap: GAP },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  stickerImage: { width: '100%', height: '100%' },
  tile: { borderRadius: 10, overflow: 'hidden' },
  pressed: { opacity: 0.6 },
  more: { marginTop: GAP, marginBottom: 14 },
  attribution: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 10,
    letterSpacing: 0.4,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tab: {
    minWidth: 72,
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  tabIndicator: { width: 22, height: 3, borderRadius: 2 },
  gifBadge: {
    height: 24,
    paddingHorizontal: 5,
    borderWidth: 1.8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
});
