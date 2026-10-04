import {
  type Album,
  CameraRoll,
  type GetPhotosParams,
  type PhotoIdentifier,
} from '@react-native-camera-roll/camera-roll';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  ImageOff,
  Images,
  Video as VideoIcon,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Easing,
  FlatList,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  checkPhotoAccess,
  openAppSettings,
  type PhotoAccess,
  requestPhotoAccess,
  selectMorePhotos,
} from '@/services/media/photoPermission';
import { radius, useAppTheme } from '@/theme';

import { formatDuration, MediaPreview } from './MediaPreview';

export { previewSize } from './MediaPreview';

export const MAX_PHOTOS_PER_MESSAGE = 10;
const PAGE_SIZE = 60;
const COLUMNS = 3;
const GAP = 2;
const MAX_ALBUM_COVERS = 60;
const ALBUM_PADDING = 14;
const ALBUM_GAP = 12;
const HEADER_HEIGHT = 58;

export type PickedPhoto = { uri: string; width: number; height: number; video: boolean };

type Media = PickedPhoto & { id: string; duration: number | null };
export type AlbumOption = {
  key: string;
  title: string;
  count: number;
  /** iOS keeps system albums (Favorites, Screenshots…) apart from user albums. */
  groupType: 'Album' | 'SmartAlbum';
};
export type MediaSource =
  | { kind: 'recents' | 'photos' | 'videos' }
  | { kind: 'album'; album: AlbumOption };
type Snap = 'expanded' | 'collapsed' | 'hidden';

/** Height of the sheet when it first opens; the composer sits right above it. */
export const galleryCollapsedHeight = (windowHeight: number) => Math.round(windowHeight * 0.45);

/** Device albums: non-empty, unique, biggest first. */
export function toAlbumOptions(list: readonly Album[]): AlbumOption[] {
  const seen = new Set<string>();
  const albums: AlbumOption[] = [];
  for (const a of [...list].sort((x, y) => y.count - x.count)) {
    const key = a.id || a.title;
    if (a.count <= 0 || !a.title || seen.has(key)) continue;
    seen.add(key);
    albums.push({
      key,
      title: a.title,
      count: a.count,
      groupType: a.type === 'SmartAlbum' ? 'SmartAlbum' : 'Album',
    });
  }
  return albums;
}

/** Camera roll filter for a source. Android albums are folders matched by name only. */
export function mediaQuery(
  source: MediaSource,
  platform = Platform.OS,
): Pick<GetPhotosParams, 'assetType' | 'groupTypes' | 'groupName'> {
  switch (source.kind) {
    case 'photos':
      return { assetType: 'Photos' };
    case 'videos':
      return { assetType: 'Videos' };
    case 'album':
      return platform === 'ios'
        ? { assetType: 'All', groupTypes: source.album.groupType, groupName: source.album.title }
        : { assetType: 'All', groupName: source.album.title };
    default:
      return { assetType: 'All' };
  }
}

/** Where the sheet goes when a drag ends (`position` = distance from fully expanded). */
export function settleSheet({
  position,
  velocity,
  collapsedY,
  full,
}: {
  position: number;
  velocity: number;
  collapsedY: number;
  full: number;
}): Snap {
  if (velocity > 1) return position < collapsedY ? 'collapsed' : 'hidden';
  if (velocity < -1) return 'expanded';
  if (position > collapsedY + (full - collapsedY) * 0.3) return 'hidden';
  return position < collapsedY / 2 ? 'expanded' : 'collapsed';
}

const SOURCE_TITLES = { recents: 'Recents', photos: 'Photos', videos: 'Videos' } as const;
const sourceTitle = (s: MediaSource) => (s.kind === 'album' ? s.album.title : SOURCE_TITLES[s.kind]);
const sameSource = (a: MediaSource, b: MediaSource) =>
  a.kind === b.kind && (a.kind !== 'album' || (b.kind === 'album' && a.album.key === b.album.key));

const toMedia = ({ node }: PhotoIdentifier): Media => ({
  id: node.id || node.image.uri,
  uri: node.image.uri,
  width: node.image.width,
  height: node.image.height,
  video: (node.type ?? '').startsWith('video'),
  duration: node.image.playableDuration ?? null,
});

type Props = {
  visible: boolean;
  /** Visible height while collapsed; the screen keeps the same space free under the composer. */
  collapsedHeight: number;
  /** Space kept free at the top (status bar) when fully expanded. */
  topInset: number;
  onClose: () => void;
  /** The close animation finished. */
  onHidden?: () => void;
  onSend: (photos: PickedPhoto[]) => void;
};

/**
 * In-screen media picker: opens from the bottom at about half height with the chat still
 * visible, and drags up to full height or down to close. Pick up to 10 photos or videos.
 */
export function GallerySheet({
  visible,
  collapsedHeight,
  topInset,
  onClose,
  onHidden,
  onSend,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const albumTile = (width - ALBUM_PADDING * 2 - ALBUM_GAP * (COLUMNS - 1)) / COLUMNS;

  const [mounted, setMounted] = useState(false);
  const [full, setFull] = useState(0);
  const [snap, setSnap] = useState<Snap>('hidden');
  const [access, setAccess] = useState<PhotoAccess | 'checking'>('checking');
  const [source, setSource] = useState<MediaSource>({ kind: 'recents' });
  const [view, setView] = useState<'media' | 'albums'>('media');
  const [menuOpen, setMenuOpen] = useState(false);
  const [albums, setAlbums] = useState<AlbumOption[] | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Media | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const page = useRef<{ cursor?: string; hasMore: boolean; request: number; busy: boolean }>({
    hasMore: true,
    request: 0,
    busy: false,
  });

  const canRead = access === 'granted' || access === 'limited';

  // --- Sheet position -------------------------------------------------------------------
  const translate = useRef(new Animated.Value(10000)).current;
  const collapsedY = Math.max(0, full - collapsedHeight);
  const geometry = useRef({ full, collapsedY, snap });
  geometry.current = { full, collapsedY, snap };

  const animateTo = useCallback(
    (next: Snap, done?: () => void) => {
      const { full: f, collapsedY: c } = geometry.current;
      setSnap(next);
      geometry.current.snap = next;
      const toValue = next === 'expanded' ? 0 : next === 'collapsed' ? c : f;
      const anim =
        next === 'hidden'
          ? Animated.timing(translate, {
              toValue,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            })
          : Animated.spring(translate, {
              toValue,
              damping: 28,
              stiffness: 280,
              mass: 1,
              overshootClamping: true,
              useNativeDriver: true,
            });
      anim.start(({ finished }) => finished && done?.());
    },
    [translate],
  );

  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const finish = () => {
      setMounted(false);
      setPreview(null);
      onHiddenRef.current?.();
    };
    if (geometry.current.snap === 'hidden') finish();
    else animateTo('hidden', finish);
  }, [visible, animateTo]);

  useEffect(() => {
    if (!visible || !mounted || !full) return;
    if (geometry.current.snap === 'hidden') translate.setValue(full);
    animateTo('collapsed');
  }, [visible, mounted, full, collapsedHeight, animateTo, translate]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useMemo(() => {
    let start = 0;
    const clamp = (v: number) => Math.min(Math.max(v, 0), geometry.current.full);
    const settle = (dy: number, vy: number) => {
      const { full: f, collapsedY: c } = geometry.current;
      const next = settleSheet({ position: clamp(start + dy), velocity: vy, collapsedY: c, full: f });
      if (next === 'hidden') onCloseRef.current();
      else animateTo(next);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        translate.stopAnimation();
        const { snap: s, collapsedY: c } = geometry.current;
        start = s === 'expanded' ? 0 : c;
      },
      onPanResponderMove: (_, g) => translate.setValue(clamp(start + g.dy)),
      onPanResponderRelease: (_, g) => settle(g.dy, g.vy),
      onPanResponderTerminate: (_, g) => settle(g.dy, g.vy),
    });
  }, [animateTo, translate]);

  const footerShift = useMemo(() => Animated.multiply(translate, -1), [translate]);

  // --- Access and data ------------------------------------------------------------------
  const refreshAccess = useCallback(async (prompt: boolean) => {
    const current = await checkPhotoAccess();
    if (current === 'denied' && prompt) setAccess(await requestPhotoAccess());
    else setAccess(current);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setMenuOpen(false);
    setView('media');
    setSource({ kind: 'recents' });
    refreshAccess(true);
    // Coming back from Settings (or the system photo picker) may have changed access.
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') refreshAccess(false);
    });
    return () => sub.remove();
  }, [visible, refreshAccess]);

  const loadPage = useCallback(
    async (reset: boolean) => {
      const state = page.current;
      if (!reset && (!state.hasMore || state.busy)) return;
      const request = reset ? state.request + 1 : state.request;
      page.current = reset
        ? { hasMore: true, request, busy: true }
        : { ...state, busy: true };
      setLoading(true);
      setError(false);
      try {
        const result = await CameraRoll.getPhotos({
          first: PAGE_SIZE,
          after: reset ? undefined : state.cursor,
          ...mediaQuery(source),
          include: ['imageSize', 'playableDuration'],
        });
        if (page.current.request !== request) return;
        page.current = {
          request,
          busy: false,
          cursor: result.page_info.end_cursor,
          hasMore: result.page_info.has_next_page,
        };
        const next = result.edges.map(toMedia);
        setItems(prev => (reset ? next : [...prev, ...next]));
      } catch {
        if (page.current.request !== request) return;
        page.current = { ...page.current, busy: false };
        setError(true);
      } finally {
        if (page.current.request === request) setLoading(false);
      }
    },
    [source],
  );

  useEffect(() => {
    if (!visible || !canRead) return;
    setItems([]);
    loadPage(true);
  }, [visible, canRead, loadPage]);

  // Album list once per opening; covers load one at a time so the native side never gets a burst.
  useEffect(() => {
    if (!visible || !canRead) return;
    let cancelled = false;
    (async () => {
      let options: AlbumOption[];
      try {
        options = toAlbumOptions(
          await CameraRoll.getAlbums({
            assetType: 'All',
            albumType: Platform.OS === 'ios' ? 'All' : 'Album',
          }),
        );
      } catch {
        options = [];
      }
      if (cancelled) return;
      setAlbums(options);
      let batch: Record<string, string> = {};
      for (const [i, a] of options.slice(0, MAX_ALBUM_COVERS).entries()) {
        try {
          const res = await CameraRoll.getPhotos({ first: 1, ...mediaQuery({ kind: 'album', album: a }) });
          const uri = res.edges[0]?.node.image.uri;
          if (uri) batch[a.key] = uri;
        } catch {
          // No cover; the card shows a placeholder.
        }
        if (cancelled) return;
        if (i % 6 === 5 || i === options.length - 1) {
          const done = batch;
          batch = {};
          setCovers(prev => ({ ...prev, ...done }));
        }
      }
      if (Object.keys(batch).length) setCovers(prev => ({ ...prev, ...batch }));
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, canRead]);

  const toggle = useCallback((item: Media) => {
    setSelected(prev => {
      if (prev.some(p => p.id === item.id)) return prev.filter(p => p.id !== item.id);
      if (prev.length >= MAX_PHOTOS_PER_MESSAGE) return prev;
      return [...prev, item];
    });
  }, []);

  const choose = (next: MediaSource) => {
    setMenuOpen(false);
    setView('media');
    if (!sameSource(next, source)) setSource(next);
  };

  // --- Back button ------------------------------------------------------------------------
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) setMenuOpen(false);
      else if (view === 'albums') setView('media');
      else if (geometry.current.snap === 'expanded') animateTo('collapsed');
      else onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible, menuOpen, view, animateTo]);

  if (!mounted) return null;

  const order = new Map(selected.map((p, i) => [p.id, i + 1]));
  const title = view === 'albums' ? 'Albums' : sourceTitle(source);

  let body;
  if (access === 'checking') {
    body = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  } else if (!canRead) {
    const blocked = access === 'blocked' || access === 'unavailable';
    body = (
      <View style={styles.center}>
        <EmptyState
          icon={<Images size={34} color={colors.primary} />}
          title="Share photos in chat"
          text={
            blocked
              ? 'Photo access is turned off. Allow it in Settings to pick photos from your albums.'
              : 'Allow Nexity to access your photos so you can pick them from your albums.'
          }
          action={
            <Button
              title={blocked ? 'Open Settings' : 'Allow access'}
              onPress={() =>
                blocked ? openAppSettings() : requestPhotoAccess().then(setAccess)
              }
              style={styles.cta}
            />
          }
        />
      </View>
    );
  } else if (view === 'albums') {
    body = (
      <FlatList
        key="albums"
        data={albums ?? []}
        keyExtractor={a => a.key}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.albumRow}
        contentContainerStyle={[styles.albumGrid, { paddingBottom: insets.bottom + 16 }]}
        onScrollBeginDrag={() => snap === 'collapsed' && animateTo('expanded')}
        initialNumToRender={12}
        windowSize={5}
        ListEmptyComponent={
          albums ? (
            <EmptyState
              icon={<Images size={34} color={colors.primary} />}
              title="No albums"
              text="Albums on this device will show up here."
            />
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => choose({ kind: 'album', album: item })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.count} items`}
            style={({ pressed }) => [{ width: albumTile }, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.albumCover,
                { width: albumTile, height: albumTile, backgroundColor: colors.surfaceAlt },
              ]}
            >
              {covers[item.key] ? (
                <Image
                  source={{ uri: covers[item.key] }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  resizeMethod="resize"
                  fadeDuration={0}
                />
              ) : (
                <Images size={22} color={colors.textSecondary} />
              )}
            </View>
            <Text style={[styles.albumName, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.albumCount, { color: colors.textSecondary }]}>
              {item.count.toLocaleString('en-US')}
            </Text>
          </Pressable>
        )}
      />
    );
  } else {
    body = (
      <FlatList
        key="media"
        data={items}
        keyExtractor={p => p.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: insets.bottom + (selected.length ? 72 : 8) },
        ]}
        initialNumToRender={COLUMNS * 6}
        maxToRenderPerBatch={COLUMNS * 6}
        windowSize={7}
        onScrollBeginDrag={() => snap === 'collapsed' && animateTo('expanded')}
        onEndReached={() => loadPage(false)}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          access === 'limited' ? (
            <View style={[styles.limited, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.limitedText, { color: colors.text }]}>
                Nexity can only see the photos you selected.
              </Text>
              <Pressable
                onPress={() => selectMorePhotos().then(setAccess)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.limitedAction, { color: colors.primary }]}>Manage</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon={<ImageOff size={34} color={colors.primary} />}
              title={error ? "Couldn't load media" : 'Nothing here yet'}
              text={error ? 'Please try again.' : 'Photos and videos you take or save will show up here.'}
            />
          )
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator color={colors.primary} style={styles.more} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Tile
            item={item}
            size={tile}
            index={order.get(item.id) ?? 0}
            full={selected.length >= MAX_PHOTOS_PER_MESSAGE}
            onPress={toggle}
            onLongPress={setPreview}
          />
        )}
        extraData={selected}
      />
    );
  }

  const menu: { source: MediaSource; label: string; Icon: typeof Clock }[] = [
    { source: { kind: 'recents' }, label: 'Recents', Icon: Clock },
    { source: { kind: 'photos' }, label: 'Photos', Icon: ImageIcon },
    { source: { kind: 'videos' }, label: 'Videos', Icon: VideoIcon },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: topInset }]}
      onLayout={e => setFull(Math.round(e.nativeEvent.layout.height))}
    >
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, transform: [{ translateY: translate }] },
        ]}
      >
        <View {...pan.panHandlers} style={styles.header}>
          <Pressable
            onPress={() => animateTo(snap === 'expanded' ? 'collapsed' : 'expanded')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={snap === 'expanded' ? 'Collapse' : 'Expand'}
            style={styles.handleArea}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </Pressable>
          <View style={styles.headerRow}>
            <View style={styles.side}>
              {view === 'albums' ? (
                <Pressable
                  onPress={() => setView('media')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <ArrowLeft size={22} color={colors.text} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => canRead && setMenuOpen(o => !o)}
              disabled={!canRead}
              accessibilityRole="button"
              accessibilityLabel={`${title}. Change what is shown`}
              style={styles.titleButton}
              hitSlop={8}
            >
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {canRead ? <ChevronDown size={18} color={colors.text} /> : null}
            </Pressable>
            <View style={[styles.side, styles.sideRight]}>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.flex}>{body}</View>

        {menuOpen ? (
          <>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMenuOpen(false)}
              accessibilityLabel="Close menu"
            />
            <View
              style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {menu.map(({ source: s, label, Icon }) => {
                const active = view === 'media' && sameSource(s, source);
                return (
                  <Pressable
                    key={label}
                    onPress={() => choose(s)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    <Icon size={20} color={colors.text} />
                    <Text style={[styles.menuText, { color: colors.text }]}>{label}</Text>
                    {active ? <Check size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setView('albums');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: view === 'albums' }}
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Images size={20} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>All albums</Text>
                {view === 'albums' ? <Check size={18} color={colors.primary} /> : null}
              </Pressable>
            </View>
          </>
        ) : null}

        {selected.length && view === 'media' ? (
          <Animated.View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: 10 + insets.bottom,
                transform: [{ translateY: footerShift }],
              },
            ]}
          >
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {selected.length} of {MAX_PHOTOS_PER_MESSAGE} selected
            </Text>
            <Button
              title={`Send${selected.length > 1 ? ` ${selected.length}` : ''}`}
              onPress={() =>
                onSend(
                  selected.map(({ uri, width: w, height: h, video }) => ({
                    uri,
                    width: w,
                    height: h,
                    video,
                  })),
                )
              }
              style={styles.send}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
      <MediaPreview media={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

const Tile = memo(function MediaTile({
  item,
  size,
  index,
  full,
  onPress,
  onLongPress,
}: {
  item: Media;
  size: number;
  index: number;
  full: boolean;
  onPress: (item: Media) => void;
  onLongPress: (item: Media) => void;
}) {
  const { colors } = useAppTheme();
  const picked = index > 0;
  const kind = item.video ? 'Video' : 'Photo';
  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={300}
      disabled={full && !picked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked, disabled: full && !picked }}
      accessibilityLabel={picked ? `${kind}, selected ${index}` : kind}
      accessibilityHint="Long press to preview"
      style={{ width: size, height: size, backgroundColor: colors.surfaceAlt }}
    >
      {/* `resize` decodes at tile size; full-size decodes of a whole grid run Android out of memory. */}
      <Image
        source={{ uri: item.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
      />
      {item.video && item.duration != null ? (
        <Text style={styles.duration} allowFontScaling={false}>
          {formatDuration(item.duration)}
        </Text>
      ) : null}
      {picked ? <View style={[StyleSheet.absoluteFill, styles.pickedShade]} /> : null}
      {full && !picked ? <View style={[StyleSheet.absoluteFill, styles.disabledShade]} /> : null}
      <View style={[styles.badge, picked && { backgroundColor: colors.button }]}>
        {picked ? (
          <Text style={styles.badgeText} allowFontScaling={false}>
            {index}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  flex: { flex: 1 },
  header: { height: HEADER_HEIGHT },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 38, height: 4.5, borderRadius: 3 },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  side: { width: 40 },
  sideRight: { alignItems: 'flex-end' },
  titleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  title: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  center: { flex: 1, justifyContent: 'center' },
  loader: { marginTop: 48 },
  more: { marginVertical: 16 },
  cta: { minWidth: 200 },
  pressed: { opacity: 0.7 },
  menu: {
    position: 'absolute',
    top: HEADER_HEIGHT - 4,
    alignSelf: 'center',
    width: 220,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600' },
  albumGrid: { flexGrow: 1, paddingHorizontal: ALBUM_PADDING, paddingTop: 6 },
  albumRow: { gap: ALBUM_GAP, marginBottom: 16 },
  albumCover: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumName: { fontSize: 13.5, fontWeight: '700', marginTop: 6 },
  albumCount: { fontSize: 12.5, marginTop: 1 },
  grid: { flexGrow: 1 },
  gridRow: { gap: GAP, marginBottom: GAP },
  limited: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 10,
    padding: 12,
    borderRadius: radius.md,
  },
  limitedText: { flex: 1, fontSize: 13, fontWeight: '600' },
  limitedAction: { fontSize: 13.5, fontWeight: '800' },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 5,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  pickedShade: { backgroundColor: 'rgba(255,255,255,0.28)' },
  disabledShade: { backgroundColor: 'rgba(0,0,0,0.35)' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  count: { fontSize: 13.5, fontWeight: '600' },
  send: { minWidth: 120 },
});
