import {
  Ban,
  Flag,
  ImageIcon,
  Link,
  Send,
} from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PermissionIcon,
  PermissionSheet,
} from '@/components/permissions/PermissionSheet';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ToastCard, useToast } from '@/components/ui/Toast';
import type { SheetPhase } from '@/features/permissions/permissionFlow';
import {
  PERMISSION_COPY,
  type PermissionType,
} from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { useStatusBar } from '@/navigation/useStatusBar';
import {
  type Mood,
  moodPalettes,
  radius,
  resolveTheme,
  spacing,
  useAppTheme,
} from '@/theme';
import { ThemeScope } from '@/theme/ThemeProvider';

import { FollowButtonDemo, PhotoEditorDemo } from './BuildingBlockDemos';

type Preview = 'light' | 'dark' | 'mood';
const MOODS = Object.keys(moodPalettes) as Mood[];

/** Dev-only: shared components in Light, Dark and a mood, plus the live permission flow. */
export function ComponentGalleryScreen() {
  const [preview, setPreview] = useState<Preview>('light');
  const [mood, setMood] = useState<Mood>('romantic');
  const theme = useMemo(
    () =>
      preview === 'mood'
        ? resolveTheme('light', mood, 'light')
        : resolveTheme(preview, null, preview),
    [preview, mood],
  );

  return (
    <ThemeScope theme={theme}>
      <Gallery
        preview={preview}
        onPreview={setPreview}
        mood={mood}
        onMood={setMood}
      />
    </ThemeScope>
  );
}

function Gallery({
  preview,
  onPreview,
  mood,
  onMood,
}: {
  preview: Preview;
  onPreview: (p: Preview) => void;
  mood: Mood;
  onMood: (m: Mood) => void;
}) {
  const { colors } = useAppTheme();
  const toast = useToast();
  useStatusBar();

  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'public' | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [sheetPhase, setSheetPhase] = useState<SheetPhase | null>(null);
  const [shimmer, setShimmer] = useState(true);
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <AppBar title="Component gallery" subtitle="Dev only" back />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chips} accessibilityRole="tablist">
          {(['light', 'dark', 'mood'] as const).map(p => (
            <Chip
              key={p}
              label={p === 'mood' ? 'Mood' : p === 'light' ? 'Light' : 'Dark'}
              active={preview === p}
              onPress={() => onPreview(p)}
            />
          ))}
        </View>
        {preview === 'mood' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {MOODS.map(m => (
              <Chip
                key={m}
                label={m[0].toUpperCase() + m.slice(1)}
                active={mood === m}
                onPress={() => onMood(m)}
              />
            ))}
          </ScrollView>
        ) : null}

        <Section title="Permissions (live)">
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Tap Use: our sheet, then the OS popup. Deny once for Try again, deny
            again (Android) for Open Settings. Allow in Settings and come back:
            the action continues by itself.
          </Text>
          {(['camera', 'photos', 'microphone', 'notifications'] as const).map(
            type => (
              <PermissionRow key={type} type={type} />
            ),
          )}
        </Section>

        <Section title="Permission sheet states (preview)">
          <View style={styles.row}>
            {(['ask', 'denied', 'blocked'] as const).map(phase => (
              <Button
                key={phase}
                title={phase[0].toUpperCase() + phase.slice(1)}
                variant="secondary"
                onPress={() => setSheetPhase(phase)}
                style={styles.flex}
              />
            ))}
          </View>
        </Section>

        <Section title="PermissionGate (photos)">
          <View style={[styles.gate, { borderColor: colors.border }]}>
            <PermissionGate type="photos">
              <EmptyState
                icon={<ImageIcon size={32} color={colors.primary} />}
                title="Photos access is on"
                text="A gallery grid would render here."
              />
            </PermissionGate>
          </View>
        </Section>

        <Section title="ActionSheet">
          <Button
            title="Open post menu"
            variant="secondary"
            onPress={() => setMenu(true)}
          />
        </Section>

        <Section title="ConfirmDialog">
          <View style={styles.row}>
            <Button
              title="Destructive"
              variant="secondary"
              onPress={() => setConfirm('discard')}
              style={styles.flex}
            />
            <Button
              title="Default"
              variant="secondary"
              onPress={() => setConfirm('public')}
              style={styles.flex}
            />
          </View>
        </Section>

        <Section title="Toast">
          <View style={styles.toasts}>
            <ToastCard type="success" message="Post shared" />
            <ToastCard type="error" message="Couldn't upload. Tap to retry." />
            <ToastCard type="info" message="Link copied" />
          </View>
          <View style={styles.row}>
            <Button
              title="Success"
              variant="secondary"
              onPress={() => toast.success('Post shared')}
              style={styles.flex}
            />
            <Button
              title="Error"
              variant="secondary"
              onPress={() => toast.error("Couldn't upload. Tap to retry.")}
              style={styles.flex}
            />
            <Button
              title="Info"
              variant="secondary"
              onPress={() => toast.info('Link copied')}
              style={styles.flex}
            />
          </View>
        </Section>

        <Section title="EmptyState">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <EmptyState
              icon={<ImageIcon size={32} color={colors.primary} />}
              title="No posts yet"
              text="When you share photos and videos, they'll appear here."
              actionLabel="Create post"
              onAction={() => toast.info('Create post tapped')}
            />
          </View>
        </Section>

        <Section title="SkeletonLoader">
          <View
            style={[styles.card, styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessible
            accessibilityLabel="Loading post"
          >
            <View style={styles.skeletonHeader}>
              <SkeletonLoader variant="circle" size={40} shimmer={shimmer} />
              <SkeletonLoader variant="line" lines={2} width="50%" shimmer={shimmer} />
            </View>
            <SkeletonLoader variant="rect" height={220} shimmer={shimmer} />
            <SkeletonLoader variant="line" lines={3} shimmer={shimmer} />
          </View>
          <Button
            title={shimmer ? 'Turn shimmer off' : 'Turn shimmer on'}
            variant="ghost"
            onPress={() => setShimmer(s => !s)}
          />
        </Section>

        <Section title="FollowButton (mocked states)">
          <FollowButtonDemo />
        </Section>

        <Section title="MediaFit, filters, export and upload">
          <PhotoEditorDemo width={width - spacing.md * 2} />
        </Section>
      </ScrollView>

      <ActionSheet
        visible={menu}
        title="Post"
        message="Actions for this post"
        onClose={() => setMenu(false)}
        options={[
          {
            label: 'Share',
            icon: <Send size={22} color={colors.text} />,
            onPress: () => toast.info('Share'),
          },
          {
            label: 'Copy link',
            icon: <Link size={22} color={colors.text} />,
            onPress: () => toast.success('Link copied'),
          },
          {
            label: 'Report',
            icon: <Flag size={22} color={colors.danger} />,
            destructive: true,
            onPress: () => toast.info('Thanks for letting us know'),
          },
          {
            label: 'Block',
            icon: <Ban size={22} color={colors.danger} />,
            destructive: true,
            onPress: () => toast.error('Blocked'),
          },
        ]}
      />

      <ConfirmDialog
        visible={confirm === 'discard'}
        title="Discard story?"
        message="If you go back now, you'll lose your edits."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirm(null);
          toast.info('Discarded');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'public'}
        title="Make account public?"
        message="Anyone will be able to see your posts and reels."
        confirmLabel="Make public"
        loading={confirmBusy}
        onConfirm={() => {
          setConfirmBusy(true);
          setTimeout(() => {
            setConfirmBusy(false);
            setConfirm(null);
            toast.success('Account is public');
          }, 1200);
        }}
        onCancel={() => setConfirm(null)}
      />

      <PermissionSheet
        visible={sheetPhase !== null}
        type="camera"
        phase={sheetPhase ?? 'ask'}
        onPrimary={() => setSheetPhase(null)}
        onClose={() => setSheetPhase(null)}
      />
    </SafeAreaView>
  );
}

function PermissionRow({ type }: { type: PermissionType }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const permission = usePermission(type);
  const name = PERMISSION_COPY[type].name;

  return (
    <View style={[styles.permRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <PermissionIcon type={type} size={22} />
      <View style={styles.flex}>
        <Text style={[styles.permName, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.permStatus, { color: colors.textSecondary }]}>
          {permission.status ?? 'checking…'}
          {permission.asked ? ' · asked' : ''}
        </Text>
      </View>
      <Button
        title="Use"
        variant="secondary"
        onPress={() =>
          permission.request(() => toast.success(`${name} allowed, continuing`))
        }
        style={styles.useButton}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: colors.textSecondary }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 140, gap: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  note: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  gate: {
    height: 320,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  toasts: { gap: spacing.sm, alignItems: 'center' },
  skeletonCard: { padding: spacing.md, gap: spacing.md },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  permName: { fontSize: 15, fontWeight: '700' },
  permStatus: { fontSize: 12.5, marginTop: 2 },
  useButton: { minHeight: 40, paddingHorizontal: 16 },
});
