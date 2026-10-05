import { Download, Play, SendHorizontal, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { useAppTheme } from '@/theme';
import { timeAgoLong } from '@/utils/time';

import { Thumb } from './MediaBubble';
import { hasVideoPlayer, previewSize, VideoPreview } from './MediaPreview';

const WHITE = '#FFFFFF';
const GRID_GAP = 4;
const HEADER_HEIGHT = 56;
const REPLY_BAR_HEIGHT = 64;

export type ViewerItem = {
  /** What to show: the file on this device when there is one. */
  uri: string;
  /** The stored copy, used for saving. */
  remoteUrl: string;
  video: boolean;
  width: number | null;
  height: number | null;
};

export type ViewerTarget = {
  messageId: string;
  items: ViewerItem[];
  /** Albums open on the grid; a single photo / video opens straight in the viewer. */
  album: boolean;
  sender: { name: string; avatarUrl: string | null };
  createdAt: string;
  canReply: boolean;
};

type Props = {
  target: ViewerTarget | null;
  onClose: () => void;
  /** `index` is the album item replied to; null for a single photo / video. */
  onReply: (text: string, index: number | null) => void;
  onSave: (item: ViewerItem) => Promise<void>;
};

/**
 * Instagram's album flow in one modal: a grid of every photo / video, and a
 * full-screen pager for one item with save and reply.
 */
export function AlbumViewer({ target, onClose, onReply, onSave }: Props) {
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    setPage(target && !target.album ? 0 : null);
  }, [target]);

  const back = () => {
    if (target?.album && page !== null) setPage(null);
    else onClose();
  };

  return (
    <Modal
      visible={Boolean(target)}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={back}
    >
      {target ? (
        page === null ? (
          <AlbumGrid target={target} onClose={onClose} onOpen={setPage} />
        ) : (
          <MediaPager
            target={target}
            start={page}
            onClose={back}
            onReply={(text, index) => {
              onReply(text, target.album ? index : null);
              onClose();
            }}
            onSave={onSave}
          />
        )
      ) : null}
    </Modal>
  );
}

function AlbumGrid({
  target,
  onClose,
  onOpen,
}: {
  target: ViewerTarget;
  onClose: () => void;
  onOpen: (index: number) => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = (width - GRID_GAP * 3) / 2;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.gridHeader, { paddingTop: insets.top }]}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.iconButton}
        >
          <X size={26} color={colors.text} />
        </Pressable>
      </View>
      <FlatList
        data={target.items}
        keyExtractor={(_, i) => String(i)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + GRID_GAP },
        ]}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => onOpen(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${item.video ? 'Video' : 'Photo'} ${index + 1} of ${
              target.items.length
            }`}
            style={({ pressed }) => [
              styles.gridTile,
              { width: tile, height: tile * 1.25, backgroundColor: colors.surfaceAlt },
              pressed && styles.pressed,
            ]}
          >
            <Thumb item={{ uri: item.uri, video: item.video }} />
            {item.video ? (
              <View style={styles.gridPlay} pointerEvents="none">
                <Play size={18} color={WHITE} fill={WHITE} />
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function MediaPager({
  target,
  start,
  onClose,
  onReply,
  onSave,
}: {
  target: ViewerTarget;
  start: number;
  onClose: () => void;
  onReply: (text: string, index: number) => void;
  onSave: (item: ViewerItem) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const listRef = useRef<FlatList<ViewerItem>>(null);
  const current = target.items[index];
  const area = {
    width,
    height:
      height -
      insets.top -
      insets.bottom -
      HEADER_HEIGHT -
      (target.canReply ? REPLY_BAR_HEIGHT : 0),
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < target.items.length) setIndex(next);
  };

  const save = async () => {
    if (!current || saving) return;
    setSaving(true);
    try {
      await onSave(current);
    } finally {
      setSaving(false);
    }
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    onReply(body, index);
  };

  return (
    <View style={styles.pager}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.iconButton}
        >
          <X size={26} color={WHITE} />
        </Pressable>
        <Avatar uri={target.sender.avatarUrl} name={target.sender.name} size={34} />
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {target.sender.name}
          </Text>
          <Text style={styles.ago} numberOfLines={1}>
            {timeAgoLong(Date.parse(target.createdAt))}
            {target.items.length > 1 ? ` · ${index + 1} of ${target.items.length}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={save}
          disabled={saving || !current?.remoteUrl}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={current?.video ? 'Save video' : 'Save photo'}
          style={styles.iconButton}
        >
          {saving ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Download size={24} color={WHITE} />
          )}
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={target.items}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index: i }) => (
          <View style={[styles.page, area]}>
            <Page item={item} area={area} active={i === index} />
          </View>
        )}
      />

      {target.canReply ? (
        <KeyboardAvoidingView behavior="padding">
          <View style={[styles.replyBar, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Reply…"
              placeholderTextColor="rgba(255,255,255,0.7)"
              maxLength={2000}
              multiline
              style={styles.input}
              accessibilityLabel="Reply"
            />
            {text.trim() ? (
              <Pressable
                onPress={send}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                style={styles.iconButton}
              >
                <SendHorizontal size={24} color={WHITE} />
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}

function Page({
  item,
  area,
  active,
}: {
  item: ViewerItem;
  area: { width: number; height: number };
  active: boolean;
}) {
  if (item.video && hasVideoPlayer()) {
    const size = previewSize(
      { width: item.width ?? 0, height: item.height ?? 0 },
      area.width,
      area.height - 60,
    );
    return <VideoPreview uri={item.uri} size={size} active={active} />;
  }
  if (item.video) {
    return (
      <Text style={styles.unavailable}>Video playback needs the latest app build.</Text>
    );
  }
  return (
    <Image
      source={{ uri: item.uri }}
      style={{ width: area.width, height: area.height }}
      resizeMode="contain"
      accessibilityLabel="Photo"
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  gridHeader: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridContent: { paddingHorizontal: GRID_GAP, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  gridTile: { borderRadius: 4, overflow: 'hidden' },
  gridPlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  pager: { flex: 1, backgroundColor: '#000000' },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1 },
  name: { color: WHITE, fontSize: 15, fontWeight: '700' },
  ago: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 1 },
  page: { alignItems: 'center', justifyContent: 'center' },
  unavailable: { color: WHITE, fontSize: 13.5, fontWeight: '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: WHITE,
    fontSize: 15,
  },
});
