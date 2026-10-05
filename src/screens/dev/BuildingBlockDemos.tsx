import { useImage } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { FollowButton } from '@/components/follows/FollowButton';
import { FilterStrip } from '@/components/media/FilterStrip';
import { MediaFit } from '@/components/media/MediaFit';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { useToast } from '@/components/ui/Toast';
import {
  type Relationship,
  setRelation,
  type UserRelation,
} from '@/features/entities/entityCache';
import { bakeImage } from '@/features/media/bakeImage';
import {
  type ColorAdjustments,
  FILTER_LABELS,
  type FilterId,
  lookMatrix,
} from '@/features/media/filterEngine';
import { tempPath } from '@/features/media/localFiles';
import { type FitTransform, STORY_RATIO } from '@/features/media/mediaFit';
import { formatBytes } from '@/features/media/mediaRules';
import { type LocalMedia, pickFromLibrary } from '@/features/media/pickMedia';
import { pendingUploads } from '@/features/media/uploadJournal';
import { useMediaUpload } from '@/features/media/useMediaUpload';
import { followsApi } from '@/services/api/follows';
import { safetyApi } from '@/services/api/safety';
import { darkScreen, radius, spacing, useAppTheme } from '@/theme';

/* ---------------------------------------------------------------- Follow */

type MockUser = {
  id: string;
  username: string;
  is_private: boolean;
  relation: Partial<UserRelation>;
  note: string;
};

const MOCK_USERS: MockUser[] = [
  {
    id: 'demo-public',
    username: 'public.none',
    is_private: false,
    relation: { relationship: 'none' },
    note: 'Public, not following: Follow + Message',
  },
  {
    id: 'demo-follows-you',
    username: 'private.followsyou',
    is_private: true,
    relation: { relationship: 'none', follows_you: true },
    note: 'Private, follows you: Follow back + Message',
  },
  {
    id: 'demo-following',
    username: 'private.following',
    is_private: true,
    relation: { relationship: 'following' },
    note: 'Following: menu with Unfollow / Mute',
  },
  {
    id: 'demo-requested',
    username: 'private.requested',
    is_private: true,
    relation: { relationship: 'requested' },
    note: 'Requested: confirm cancel; no Message',
  },
  {
    id: 'demo-private',
    username: 'private.none',
    is_private: true,
    relation: { relationship: 'none' },
    note: 'Private stranger: Follow (Requested); no Message',
  },
];

type MockMode = 'success' | 'fail';

/** Swaps the follow / mute API for fakes while the demo is on screen. */
function useMockedRelationApi(mode: MockMode) {
  useEffect(() => {
    const original = {
      follow: followsApi.follow,
      unfollow: followsApi.unfollow,
      mute: safetyApi.mute,
      unmute: safetyApi.unmute,
    };
    const later = <T,>(value: T) =>
      new Promise<T>((resolve, reject) =>
        setTimeout(
          () =>
            mode === 'success'
              ? resolve(value)
              : reject(new Error('Mock network failure')),
          700,
        ),
      );
    followsApi.follow = async id =>
      later({
        status: MOCK_USERS.find(u => u.id === id)?.is_private
          ? ('pending' as const)
          : ('accepted' as const),
      });
    followsApi.unfollow = async () => later(undefined);
    safetyApi.mute = async () => later(undefined);
    safetyApi.unmute = async () => later(undefined);
    return () => {
      Object.assign(followsApi, {
        follow: original.follow,
        unfollow: original.unfollow,
      });
      Object.assign(safetyApi, {
        mute: original.mute,
        unmute: original.unmute,
      });
    };
  }, [mode]);
}

const seedMocks = () =>
  MOCK_USERS.forEach(u =>
    setRelation(u.id, {
      relationship: 'none' as Relationship,
      follows_you: false,
      muted: false,
      ...u.relation,
      is_private: u.is_private,
    }),
  );

export function FollowButtonDemo() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [mode, setMode] = useState<MockMode>('success');
  useMockedRelationApi(mode);
  useEffect(seedMocks, []);

  return (
    <View style={styles.stack}>
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Mocked API (no network). Every variant of the same user reads one cache
        entry, so tapping any of them updates all three at once. Switch to
        Failure to see the automatic rollback and error toast.
      </Text>
      <View style={styles.row}>
        <Chip
          label="Success"
          active={mode === 'success'}
          onPress={() => setMode('success')}
        />
        <Chip
          label="Failure"
          active={mode === 'fail'}
          onPress={() => setMode('fail')}
        />
        <Chip label="Reset" active={false} onPress={seedMocks} />
      </View>
      {MOCK_USERS.map(u => (
        <View
          key={u.id}
          style={[
            styles.card,
            styles.padded,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            @{u.username}
          </Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {u.note}
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Full (profile)
          </Text>
          <View style={styles.row}>
            <FollowButton
              user={u}
              variant="full"
              onMessage={() => toast.info(`Message @${u.username}`)}
            />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Compact (reel / story header)
          </Text>
          <View
            style={[
              styles.mediaStrip,
              { backgroundColor: darkScreen.background },
            ]}
          >
            <Text style={[styles.mediaName, { color: darkScreen.text }]}>
              {u.username}
            </Text>
            <FollowButton user={u} variant="compact" />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            List row
          </Text>
          <View style={styles.listRow}>
            <Text
              style={[styles.flex, { color: colors.text }]}
              numberOfLines={1}
            >
              {u.username}
            </Text>
            <FollowButton user={u} variant="row" />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------ MediaFit + filters */

const SAMPLES = [
  {
    id: 'landscape',
    label: 'Landscape 16:9',
    uri: 'https://picsum.photos/id/1015/1600/900',
  },
  {
    id: 'portrait',
    label: 'Portrait 3:4',
    uri: 'https://picsum.photos/id/1027/1200/1600',
  },
  {
    id: 'square',
    label: 'Square',
    uri: 'https://picsum.photos/id/1084/1200/1200',
  },
  {
    id: 'tall',
    label: 'Almost 9:16',
    uri: 'https://picsum.photos/id/1043/1080/1900',
  },
] as const;

const RATIOS = [
  { label: '9:16', value: STORY_RATIO },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '1.91:1', value: 1.91 },
];

const ADJUSTMENTS = ['brightness', 'contrast', 'saturation', 'warmth'] as const;

/** Remote samples are downloaded first; baking and uploading work on local files. */
async function toLocal(uri: string, fileName: string): Promise<LocalMedia> {
  if (!uri.startsWith('http'))
    return {
      uri,
      kind: 'image',
      contentType: 'image/jpeg',
      fileName,
      bytes: 0,
    };
  const path = await tempPath(`sample-${Date.now()}.jpg`);
  await ReactNativeBlobUtil.config({ path }).fetch('GET', uri);
  return {
    uri: `file://${path}`,
    kind: 'image',
    contentType: 'image/jpeg',
    fileName,
    bytes: 0,
  };
}

export function PhotoEditorDemo({ width }: { width: number }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [uri, setUri] = useState<string>(SAMPLES[0].uri);
  const [ratio, setRatio] = useState(STORY_RATIO);
  const [transform, setTransform] = useState<FitTransform | null>(null);
  const [filter, setFilter] = useState<FilterId>('normal');
  const [intensity, setIntensity] = useState(100);
  const [adjust, setAdjust] = useState<ColorAdjustments>({});
  const [exporting, setExporting] = useState(false);
  const [baked, setBaked] = useState<LocalMedia | null>(null);
  const skImage = useImage(uri);
  const matrix = useMemo(
    () => lookMatrix(filter, intensity, adjust),
    [filter, intensity, adjust],
  );
  const upload = useMediaUpload('story');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    pendingUploads('story')
      .then(p => setPending(p.length))
      .catch(() => {});
  }, [upload.items]);

  const pick = async () => {
    try {
      const [m] = await pickFromLibrary('story', { kind: 'image', limit: 1 });
      if (m) {
        setUri(m.uri);
        setTransform(null);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't open your photos",
      );
    }
  };

  const exportPhoto = async () => {
    setExporting(true);
    try {
      const local = await toLocal(uri, 'demo.jpg');
      const out = await bakeImage(local, {
        ratio,
        transform: transform ?? undefined,
        matrix,
      });
      setBaked(out);
      toast.success(`Exported ${out.width}×${out.height}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const frameWidth = ratio < 1 ? Math.min(width, 260) : width;
  const item = upload.items[0];

  return (
    <View style={styles.stack}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Photo</Text>
      <View style={styles.wrap}>
        {SAMPLES.map(s => (
          <Chip
            key={s.id}
            label={s.label}
            active={uri === s.uri}
            onPress={() => {
              setUri(s.uri);
              setTransform(null);
            }}
          />
        ))}
        <Chip label="From library…" active={false} onPress={pick} />
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Canvas
      </Text>
      <View style={styles.wrap}>
        {RATIOS.map(r => (
          <Chip
            key={r.label}
            label={r.label}
            active={ratio === r.value}
            onPress={() => {
              setRatio(r.value);
              setTransform(null);
            }}
          />
        ))}
      </View>

      <View style={styles.center}>
        <MediaFit
          key={`${uri}|${ratio}`}
          uri={uri}
          width={frameWidth}
          ratio={ratio}
          matrix={matrix}
          onChange={setTransform}
          style={styles.rounded}
        />
      </View>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        {transform
          ? `${transform.mode.toUpperCase()} · zoom ${transform.zoom.toFixed(
              2,
            )} · offset ${transform.x.toFixed(2)}, ${transform.y.toFixed(2)}`
          : 'Pinch, drag, or tap Fit / Fill'}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Filters (live)
      </Text>
      <View style={styles.bleed}>
        <FilterStrip image={skImage} value={filter} onChange={setFilter} />
      </View>
      <SliderRow
        label={`${FILTER_LABELS[filter]} intensity`}
        value={intensity}
        min={0}
        max={100}
        onChange={setIntensity}
      />
      {ADJUSTMENTS.map(key => (
        <SliderRow
          key={key}
          label={key[0].toUpperCase() + key.slice(1)}
          value={adjust[key] ?? 0}
          min={-100}
          max={100}
          centered
          onChange={v => setAdjust(a => ({ ...a, [key]: v }))}
        />
      ))}

      <Button title="Export (bake)" loading={exporting} onPress={exportPhoto} />
      {baked ? (
        <View
          style={[
            styles.card,
            styles.padded,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            {baked.width}×{baked.height} JPEG · {formatBytes(baked.bytes)}
          </Text>
          <Image
            source={{ uri: baked.uri }}
            style={[
              styles.rounded,
              styles.selfCenter,
              {
                width: frameWidth * 0.6,
                height:
                  (frameWidth * 0.6 * (baked.height ?? 1)) / (baked.width ?? 1),
              },
            ]}
            accessibilityLabel="Exported photo"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Upload to S3 (story)
          </Text>
          {item ? (
            <View style={styles.stack}>
              <View
                style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor:
                        item.status === 'error'
                          ? colors.danger
                          : colors.primary,
                      width: `${Math.round(item.progress * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.caption, { color: colors.textSecondary }]}
                accessibilityLiveRegion="polite"
              >
                {item.status} · {Math.round(item.progress * 100)}%
                {item.error ? ` · ${item.error}` : ''}
                {item.asset ? ` · media ${item.asset.id}` : ''}
              </Text>
            </View>
          ) : null}
          <View style={styles.wrap}>
            <Button
              title="Upload"
              variant="secondary"
              disabled={upload.isUploading}
              onPress={() => upload.start([baked]).catch(() => {})}
            />
            <Button
              title="Cancel"
              variant="secondary"
              disabled={!upload.isUploading}
              onPress={upload.cancel}
            />
            <Button
              title="Retry"
              variant="secondary"
              disabled={
                upload.isUploading ||
                !upload.items.some(
                  i => i.status === 'error' || i.status === 'cancelled',
                )
              }
              onPress={() => upload.retryFailed().catch(() => {})}
            />
            <Button
              title={`Resume pending (${pending})`}
              variant="secondary"
              disabled={upload.isUploading || !pending}
              onPress={() => upload.resumePending().catch(() => {})}
            />
          </View>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            Turn on airplane mode during an upload: it retries with backoff and
            fails after ~15 s; Retry continues. Kill the app mid-upload, reopen
            this screen and tap Resume pending.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  centered,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  centered?: boolean;
  onChange: (v: number) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <View style={styles.sliderHead}>
        <Text style={[styles.caption, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {value}
        </Text>
      </View>
      <Slider
        value={value}
        min={min}
        max={max}
        centered={centered}
        onChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  selfCenter: { alignSelf: 'center' },
  bleed: { marginHorizontal: -spacing.md },
  note: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 12.5 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  mediaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  mediaName: { fontSize: 14, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rounded: { borderRadius: radius.md },
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%' },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
