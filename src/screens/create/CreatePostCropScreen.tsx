import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import {
  ArrowLeft,
  ArrowRight,
  Crop,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { AdjustPanel } from '@/components/create/AdjustPanel';
import { CaptureView } from '@/components/create/CaptureView';
import { CropPhoto } from '@/components/create/CropPhoto';
import { FilterFrame } from '@/components/create/FilterFrame';
import { GalleryPicker } from '@/components/create/GalleryPicker';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { IconButton } from '@/components/ui/IconButton';
import { ZERO_ADJUSTMENTS } from '@/features/create/adjustments';
import { MAX_ITEMS } from '@/features/media/mediaRules';
import type { LocalMedia } from '@/features/media/pickMedia';
import {
  ASPECT_LABELS,
  type AspectOption,
  aspectRatioOf,
  getDraft,
  IDENTITY_CROP,
  toDraftItems,
  updateDraft,
  usePostDraft,
} from '@/features/posts/postDraft';
import {
  clearSavedDraft,
  discardDraft,
  loadSavedDraft,
  saveDraftToDisk,
} from '@/features/posts/savedDraft';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

const MAX = MAX_ITEMS.post;
const ASPECTS: AspectOption[] = ['square', 'portrait', 'landscape', 'original'];
const THUMB_GAP = 8;
/** Thumbnails sized so five fit across; more scroll sideways. */
const THUMBS_ACROSS = 5;

/** Step 1 of "New post": frame, order and adjust the photos and videos. */
export function CreatePostCropScreen({
  navigation,
}: ScreenProps<'CreatePostCrop'>) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const draft = usePostDraft();
  const { items } = draft;
  const [index, setIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  useStatusBar();

  const add = (picked: LocalMedia[]) => {
    const room = MAX - getDraft().items.length;
    if (room <= 0) return;
    const before = getDraft().items.length;
    updateDraft(d => ({
      items: [...d.items, ...toDraftItems(picked.slice(0, room))],
    }));
    setIndex(before);
    setGalleryOpen(false);
  };

  useEffect(() => {
    if (getDraft().items.length) return;
    loadSavedDraft()
      .then(saved => {
        if (!saved) return;
        Alert.alert('Continue your draft?', 'You have a post that was not shared.', [
          { text: 'Start new', onPress: () => clearSavedDraft().catch(() => {}) },
          { text: 'Continue', onPress: () => updateDraft(saved) },
        ]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (index >= items.length && items.length) setIndex(items.length - 1);
  }, [index, items.length]);

  usePreventRemove(items.length > 0, ({ data }) => {
    if (!getDraft().items.length) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Save draft?', 'You can finish this post later.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardDraft();
          navigation.dispatch(data.action);
        },
      },
      {
        text: 'Save draft',
        onPress: () => {
          const leave = () => navigation.dispatch(data.action);
          saveDraftToDisk().then(leave).catch(leave);
        },
      },
    ]);
  });

  if (!items.length) {
    return (
      <CaptureView
        mode="post"
        onClose={() => navigation.goBack()}
        onDone={picked => {
          updateDraft({ items: toDraftItems(picked.slice(0, MAX)) });
          setIndex(0);
        }}
        onSwitchMode={next => {
          if (next === 'reel') navigation.replace('CreateReel');
        }}
      />
    );
  }

  const ratio = aspectRatioOf(draft.aspect, items[0]?.media);
  const frameHeight = Math.min(width / ratio, width * 1.25);
  const frameWidth = frameHeight * ratio;
  const thumb = (width - spacing.md * 2 - THUMB_GAP * (THUMBS_ACROSS - 1)) / THUMBS_ACROSS;
  const current = items[Math.min(index, items.length - 1)]!;
  const adjustments = draft.adjustments ?? ZERO_ADJUSTMENTS;

  const move = (key: string, delta: -1 | 1) => {
    updateDraft(d => {
      const from = d.items.findIndex(i => i.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= d.items.length) return {};
      const next = [...d.items];
      [next[from], next[to]] = [next[to]!, next[from]!];
      setIndex(to);
      return { items: next };
    });
  };

  const remove = (key: string) => {
    updateDraft(d => ({ items: d.items.filter(i => i.key !== key) }));
  };

  const setAspect = (aspect: AspectOption) => {
    updateDraft(d => ({
      aspect,
      items: d.items.map(item => ({ ...item, crop: IDENTITY_CROP })),
    }));
  };

  const menuIndex = items.findIndex(i => i.key === menuKey);
  const menuOptions =
    menuIndex < 0
      ? []
      : [
          ...(menuIndex > 0
            ? [
                {
                  label: 'Move left',
                  icon: <ArrowLeft size={20} color={colors.text} />,
                  onPress: () => move(menuKey!, -1),
                },
              ]
            : []),
          ...(menuIndex < items.length - 1
            ? [
                {
                  label: 'Move right',
                  icon: <ArrowRight size={20} color={colors.text} />,
                  onPress: () => move(menuKey!, 1),
                },
              ]
            : []),
          {
            label: 'Remove',
            icon: <Trash2 size={20} color={colors.danger} />,
            destructive: true,
            onPress: () => remove(menuKey!),
          },
        ];

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()} accessibilityLabel="Close">
          <X size={26} color={colors.text} />
        </IconButton>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          New post
        </Text>
        <Pressable
          onPress={() => navigation.navigate('CreatePostDetails')}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.next, pressed && styles.pressed]}
        >
          <Text style={[styles.nextText, { color: colors.primary }]}>Next</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[styles.stage, { height: frameHeight, backgroundColor: colors.surfaceAlt }]}
        >
          <FilterFrame
            adjustments={adjustments}
            style={{ width: frameWidth, height: frameHeight }}
          >
            {current.media.kind === 'video' ? (
              <Video
                source={{ uri: current.media.uri }}
                style={{ width: frameWidth, height: frameHeight }}
                resizeMode="cover"
                repeat
                muted
                paused={!focused}
              />
            ) : (
              <CropPhoto
                uri={current.media.uri}
                imageWidth={current.media.width}
                imageHeight={current.media.height}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                crop={current.crop}
                onCrop={crop => {
                  const key = current.key;
                  updateDraft(d => ({
                    items: d.items.map(item =>
                      item.key === key ? { ...item, crop, frameWidth, frameHeight } : item,
                    ),
                  }));
                }}
              />
            )}
          </FilterFrame>
          {items.length > 1 ? (
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterText}>
                {index + 1}/{items.length}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={() =>
              setAspect(ASPECTS[(ASPECTS.indexOf(draft.aspect) + 1) % ASPECTS.length]!)
            }
            accessibilityRole="button"
            accessibilityLabel={`Frame ${ASPECT_LABELS[draft.aspect]}. Change frame`}
            style={({ pressed }) => [styles.aspectBtn, pressed && styles.pressed]}
          >
            <Crop size={16} color="#FFFFFF" />
            <Text style={styles.aspectText}>{ASPECT_LABELS[draft.aspect]}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {items.map((item, i) => {
            const active = i === index;
            return (
              <Pressable
                key={item.key}
                onPress={() => setIndex(i)}
                onLongPress={() => setMenuKey(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.media.kind === 'video' ? 'Video' : 'Photo'} ${i + 1}`}
                accessibilityHint="Long press to reorder"
                style={[
                  styles.thumb,
                  { width: thumb, height: thumb },
                  { borderColor: active ? colors.primary : 'transparent' },
                ]}
              >
                <Image source={{ uri: item.media.uri }} style={styles.thumbImg} />
                {item.media.kind === 'video' ? (
                  <View style={styles.thumbPlay} pointerEvents="none">
                    <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                ) : null}
                {items.length > 1 ? (
                  <Pressable
                    onPress={() => remove(item.key)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove item ${i + 1}`}
                    style={styles.thumbRemove}
                  >
                    <X size={12} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
          {items.length < MAX ? (
            <Pressable
              onPress={() => setGalleryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add photos or videos"
              style={[
                styles.thumb,
                styles.addTile,
                { width: thumb, height: thumb, borderColor: colors.border },
              ]}
            >
              <Plus size={24} color={colors.text} />
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.aspectRow} accessibilityRole="radiogroup">
          {ASPECTS.map(a => {
            const active = draft.aspect === a;
            return (
              <Pressable
                key={a}
                onPress={() => setAspect(a)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[
                  styles.aspectChip,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.aspectChipText, { color: active ? colors.primary : colors.text }]}
                >
                  {ASPECT_LABELS[a]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Adjust</Text>
        <AdjustPanel
          value={adjustments}
          onChange={next => updateDraft({ adjustments: next })}
        />
      </ScrollView>

      <GalleryPicker
        visible={galleryOpen}
        purpose="post"
        multiple
        alreadySelected={items.length}
        onClose={() => setGalleryOpen(false)}
        onPick={add}
      />
      <ActionSheet
        visible={menuKey !== null}
        title={menuIndex >= 0 ? `Item ${menuIndex + 1}` : undefined}
        options={menuOptions}
        onClose={() => setMenuKey(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 54 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', marginLeft: 4 },
  next: { paddingHorizontal: 12, paddingVertical: 8 },
  nextText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.6 },
  content: { paddingBottom: spacing.xl },
  stage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  aspectBtn: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  aspectText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  strip: { gap: THUMB_GAP, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  thumb: { borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlay: { position: 'absolute', left: 5, bottom: 5 },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  addTile: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  aspectRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  aspectChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
  },
  aspectChipText: { fontSize: 13.5, fontWeight: '700' },
  section: {
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
});
