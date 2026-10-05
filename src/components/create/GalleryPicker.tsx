import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { Check, ImageOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import {
  DURATION_TOLERANCE_MS,
  formatDuration,
  MAX_ITEMS,
  maxDurationMs,
  type MediaKind,
  type MediaPurpose,
} from '@/features/media/mediaRules';
import { cameraRollMedia } from '@/features/media/cameraRollMedia';
import type { LocalMedia } from '@/features/media/pickMedia';
import {
  requestAccess,
  showPermissionPrompt,
} from '@/features/media/permissionPrompt';
import { radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  purpose: MediaPurpose;
  /** Restrict to one kind (e.g. reels are video only). */
  kind?: MediaKind;
  /** Allow picking several; otherwise tapping a tile finishes at once. */
  multiple?: boolean;
  /** Files already chosen, so the limit counts them. */
  alreadySelected?: number;
  onClose: () => void;
  onPick: (media: LocalMedia[]) => void;
};

const COLUMNS = 3;
const GAP = 2;
const PAGE = 60;
const WHITE = '#FFFFFF';
const INK = '#0F172A';

const toMedia = cameraRollMedia;

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Full-screen gallery grid. Photos and videos can be selected together;
 * videos longer than the limit are dimmed and cannot be selected.
 */
export function GalleryPicker({
  visible,
  purpose,
  kind,
  multiple,
  alreadySelected = 0,
  onClose,
  onPick,
}: Props) {
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const limitMs = maxDurationMs(purpose);
  const room = Math.max(0, MAX_ITEMS[purpose] - alreadySelected);
  const [items, setItems] = useState<LocalMedia[]>([]);
  const [selected, setSelected] = useState<LocalMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(false);
  const after = useRef<string | undefined>(undefined);
  const more = useRef(false);
  const fetching = useRef(false);

  const tooLong = useCallback(
    (m: LocalMedia) =>
      m.kind === 'video' &&
      !!limitMs &&
      !!m.durationMs &&
      m.durationMs > limitMs + DURATION_TOLERANCE_MS,
    [limitMs],
  );

  const load = useCallback(
    async (reset: boolean) => {
      if (fetching.current) return;
      if (!reset && !more.current) return;
      fetching.current = true;
      if (reset) {
        setLoading(true);
        setError(false);
        setDenied(false);
      }
      try {
        // The phone's own permission dialog appears here, with no screen first.
        const access = await requestAccess('photos');
        if (access !== 'granted') {
          setDenied(true);
          if (access === 'blocked') showPermissionPrompt('photos');
          return;
        }
        const page = await CameraRoll.getPhotos({
          first: PAGE,
          after: reset ? undefined : after.current,
          assetType: kind === 'video' ? 'Videos' : kind === 'image' ? 'Photos' : 'All',
          include: ['filename', 'fileSize', 'imageSize', 'playableDuration'],
        });
        after.current = page.page_info.end_cursor;
        more.current = page.page_info.has_next_page;
        const next = page.edges.map(e => toMedia(e.node));
        setItems(prev => (reset ? next : [...prev, ...next]));
      } catch {
        setError(true);
      } finally {
        fetching.current = false;
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (visible) {
      setSelected([]);
      load(true);
    }
  }, [visible, load]);

  const toggle = (media: LocalMedia) => {
    if (tooLong(media)) {
      Alert.alert(
        'Video is too long',
        `Videos can be up to ${formatDuration(limitMs ?? 0)}. Pick a shorter one.`,
      );
      return;
    }
    if (!multiple) {
      onPick([media]);
      return;
    }
    setSelected(current => {
      if (current.some(m => m.uri === media.uri)) {
        return current.filter(m => m.uri !== media.uri);
      }
      if (current.length >= room) {
        Alert.alert(`You can add up to ${MAX_ITEMS[purpose]} items.`);
        return current;
      }
      return [...current, media];
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            style={styles.close}
          >
            <X size={26} color={WHITE} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {multiple && selected.length
              ? `${selected.length} selected`
              : 'Recent'}
          </Text>
          {multiple ? (
            <Pressable
              onPress={() => onPick(selected)}
              disabled={!selected.length}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.done}
            >
              <Text
                style={[styles.doneText, !selected.length && styles.dim]}
              >
                Next
              </Text>
            </Pressable>
          ) : (
            <View style={styles.close} />
          )}
        </View>

        {loading && !items.length ? (
          <ActivityIndicator color={WHITE} style={styles.center} />
        ) : denied || error || !items.length ? (
          <View style={styles.center}>
            <ImageOff size={34} color={WHITE} />
            <Text style={styles.stateText}>
              {denied
                ? 'Photo access is needed to choose from your gallery.'
                : error
                ? "Couldn't load your gallery."
                : 'No photos or videos found.'}
            </Text>
            <Button
              title={denied ? 'Allow access' : 'Try again'}
              variant="secondary"
              onPress={() => load(true)}
              style={styles.retry}
            />
          </View>
        ) : (
          <FlatList
            data={items}
            numColumns={COLUMNS}
            keyExtractor={(m, i) => m.uri + i}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            onEndReached={() => load(false)}
            onEndReachedThreshold={0.6}
            initialNumToRender={30}
            windowSize={7}
            renderItem={({ item }) => {
              const n = selected.findIndex(m => m.uri === item.uri);
              const long = tooLong(item);
              return (
                <Pressable
                  onPress={() => toggle(item)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    long
                      ? 'Video too long, cannot be selected'
                      : item.kind === 'video'
                      ? `Video ${clock(item.durationMs ?? 0)}`
                      : 'Photo'
                  }
                  accessibilityState={{ selected: n >= 0, disabled: long }}
                  style={{ width: size, height: size }}
                >
                  <Image source={{ uri: item.uri }} style={styles.fill} />
                  {item.kind === 'video' ? (
                    <View style={styles.duration}>
                      <Text style={styles.durationText}>
                        {clock(item.durationMs ?? 0)}
                      </Text>
                    </View>
                  ) : null}
                  {long ? <View style={styles.disabled} /> : null}
                  {multiple && !long ? (
                    <View style={[styles.mark, n >= 0 && styles.markOn]}>
                      {n >= 0 ? (
                        <Text style={styles.markText}>{n + 1}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {n >= 0 ? <View style={styles.ring} /> : null}
                </Pressable>
              );
            }}
          />
        )}
        {multiple && selected.length ? (
          <View style={styles.footer}>
            <Check size={16} color={WHITE} />
            <Text style={styles.footerText}>
              Tap Next to continue with {selected.length}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 54,
  },
  close: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: WHITE, fontSize: 17, fontWeight: '800' },
  done: { minWidth: 48, alignItems: 'flex-end', paddingRight: 8 },
  doneText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  dim: { opacity: 0.4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateText: {
    color: WHITE,
    textAlign: 'center',
    fontSize: 14.5,
    paddingHorizontal: spacing.lg,
  },
  retry: { minWidth: 160 },
  fill: { width: '100%', height: '100%', backgroundColor: '#1C1C1E' },
  duration: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  durationText: { color: WHITE, fontSize: 11.5, fontWeight: '700' },
  disabled: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  mark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: WHITE,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  markText: { color: WHITE, fontSize: 12, fontWeight: '800' },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: INK,
  },
  footerText: { color: WHITE, fontSize: 13, fontWeight: '600' },
});
