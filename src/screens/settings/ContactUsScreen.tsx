import { CommonActions, useFocusEffect } from '@react-navigation/native';
import {
  Camera,
  Check,
  ChevronRight,
  Headset,
  ImageIcon,
  ImagePlus,
  Paperclip,
  Plus,
  RotateCw,
  X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SettingsGroup, settingsStyles } from '@/components/settings/SettingsParts';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ChoiceChips } from '@/components/ui/Choice';
import { KeyboardScrollView } from '@/components/ui/KeyboardScrollView';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { TextField } from '@/components/ui/TextField';
import {
  formatBytes,
  SUPPORT_IMAGE_MAX_BYTES,
} from '@/features/media/mediaRules';
import {
  captureWithCamera,
  type LocalMedia,
  MediaError,
  pickFromLibrary,
} from '@/features/media/pickMedia';
import {
  MAX_SCREENSHOTS,
  type Screenshot,
  useScreenshots,
} from '@/features/support/useScreenshots';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { TicketStatusBadge } from '@/screens/settings/SupportTicketScreen';
import { ApiError } from '@/services/api/client';
import {
  SUPPORT_SUBJECTS,
  type SupportSubject,
  type SupportTicket,
  supportApi,
} from '@/services/api/support';
import { radius, spacing, useAppTheme } from '@/theme';
import { fullDate } from '@/utils/time';

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 1000;
const TILE_WIDTH = 62;

export function ContactUsScreen({ navigation }: ScreenProps<'ContactUs'>) {
  const { colors } = useAppTheme();
  const screenshots = useScreenshots();
  const { shots } = screenshots;
  const [subject, setSubject] = useState<SupportSubject>();
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  useStatusBar();

  useFocusEffect(
    useCallback(() => {
      supportApi
        .tickets()
        .then(setTickets)
        .catch(() => setTickets(current => current ?? []));
    }, []),
  );

  const room = MAX_SCREENSHOTS - shots.length;

  const openSources = () => {
    Keyboard.dismiss();
    setSourceOpen(true);
  };

  const pickShot = async (source: 'library' | 'camera') => {
    setShotError(null);
    try {
      const picked =
        source === 'camera'
          ? [await captureWithCamera('support', 'image')]
          : await pickFromLibrary('support', { kind: 'image', limit: room });
      const medias = picked.filter((m): m is LocalMedia => !!m);
      if (!medias.length) return;
      const skipped = screenshots.add(medias);
      if (skipped) {
        setShotError(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      }
    } catch (err) {
      setShotError(
        err instanceof MediaError
          ? err.message
          : source === 'camera'
          ? "Couldn't open the camera. Please try again."
          : "Couldn't open your photos. Please try again.",
      );
    }
  };

  const submit = async () => {
    Keyboard.dismiss();
    const text = message.trim();
    const next: typeof errors = {};
    if (!subject) next.subject = 'Choose a topic.';
    if (text.length < MESSAGE_MIN) {
      next.message = `Tell us a little more (at least ${MESSAGE_MIN} characters).`;
    }
    setErrors(next);
    if (next.subject || next.message || !subject) return;
    if (screenshots.isUploading) {
      setFormError('Wait for the screenshots to finish uploading.');
      return;
    }
    if (screenshots.hasFailed) {
      setFormError(
        'A screenshot didn’t upload. Tap it to try again, or remove it.',
      );
      return;
    }
    setFormError(null);
    setSending(true);
    try {
      const ticket = await supportApi.create({
        subject,
        message: text,
        screenshot_media_ids: screenshots.mediaIds,
      });
      screenshots.markSent();
      navigation.replace('ContactSent', { ticket });
    } catch (err) {
      setSending(false);
      if (err instanceof ApiError && err.code === 'INVALID_SCREENSHOT') {
        screenshots.clear();
        setShotError(err.message);
        return;
      }
      setFormError(
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Contact us" back />
      <KeyboardScrollView contentContainerStyle={settingsStyles.content}>
        <View style={styles.head}>
          <View style={[styles.headIcon, { backgroundColor: colors.primarySoft }]}>
            <Headset size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.headTitle, { color: colors.text }]}>
              How can we help?
            </Text>
            <Text style={[styles.headText, { color: colors.textSecondary }]}>
              Tell us what's going on. We usually reply within 24 hours.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ChoiceChips
            label="Subject"
            options={SUPPORT_SUBJECTS.map(s => ({ value: s, label: s }))}
            value={subject}
            onChange={v => {
              setSubject(v);
              setErrors(e => ({ ...e, subject: undefined }));
            }}
            error={errors.subject}
          />
          <TextField
            label="Message"
            placeholder="Describe the issue in as much detail as you can"
            value={message}
            onChangeText={v => {
              setMessage(v);
              if (errors.message) setErrors(e => ({ ...e, message: undefined }));
            }}
            multiline
            maxLength={MESSAGE_MAX}
            textAlignVertical="top"
            style={styles.textarea}
            error={errors.message}
            hint={`${message.length}/${MESSAGE_MAX}`}
          />

          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>
              Screenshots{' '}
              <Text style={[styles.optional, { color: colors.textSecondary }]}>
                (optional)
              </Text>
            </Text>
            {shots.length ? (
              <Text style={[styles.count, { color: colors.textSecondary }]}>
                {shots.length}/{MAX_SCREENSHOTS}
              </Text>
            ) : null}
          </View>
          {shots.length ? (
            <View style={styles.shotGrid}>
              {shots.map(s => (
                <ShotTile
                  key={s.key}
                  shot={s}
                  onRetry={() => screenshots.retry(s.key)}
                  onRemove={() => {
                    screenshots.remove(s.key);
                    setShotError(null);
                  }}
                />
              ))}
              {room > 0 ? (
                <Pressable
                  onPress={openSources}
                  accessibilityRole="button"
                  accessibilityLabel="Add another screenshot"
                  style={({ pressed }) => [
                    styles.tile,
                    styles.addTile,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inputBackground,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Plus size={22} color={colors.primary} />
                  <Text style={[styles.dropSub, { color: colors.textSecondary }]}>
                    Add
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={openSources}
              accessibilityRole="button"
              accessibilityLabel="Upload screenshots"
              style={({ pressed }) => [
                styles.drop,
                { borderColor: colors.border, backgroundColor: colors.inputBackground },
                pressed && styles.pressed,
              ]}
            >
              <ImagePlus size={22} color={colors.primary} />
              <Text style={[styles.dropTitle, { color: colors.text }]}>
                Upload screenshots
              </Text>
              <Text style={[styles.dropSub, { color: colors.textSecondary }]}>
                Up to {MAX_SCREENSHOTS} · {formatBytes(SUPPORT_IMAGE_MAX_BYTES)}{' '}
                each · gallery or camera
              </Text>
            </Pressable>
          )}
          {shotError ? (
            <Text style={[styles.fieldError, { color: colors.danger }]}>
              {shotError}
            </Text>
          ) : null}

          {formError ? (
            <View style={styles.formError}>
              <Banner tone="error" message={formError} />
            </View>
          ) : null}
          <Button
            title="Submit"
            loadingTitle="Sending…"
            loading={sending}
            onPress={submit}
            style={styles.submit}
          />
        </View>

        {tickets && tickets.length ? (
          <SettingsGroup title="Your requests">
            {tickets.map(t => (
              <Pressable
                key={t.id}
                onPress={() => navigation.navigate('SupportTicket', { ticket: t })}
                accessibilityRole="button"
                accessibilityLabel={`${t.subject}, request ${t.reference}`}
                style={({ pressed }) => [
                  styles.ticket,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <View style={styles.flex}>
                  <View style={styles.ticketHead}>
                    <Text
                      style={[styles.ticketTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {t.subject}
                    </Text>
                    <TicketStatusBadge status={t.status} />
                  </View>
                  <Text style={[styles.ticketMeta, { color: colors.textSecondary }]}>
                    #{t.reference} · {fullDate(t.created_at)}
                  </Text>
                  <Text
                    style={[styles.ticketBody, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {t.message}
                  </Text>
                  {t.screenshot_urls.length ? (
                    <View style={styles.ticketAttach}>
                      <Paperclip size={12} color={colors.textSecondary} />
                      <Text
                        style={[styles.ticketMeta, { color: colors.textSecondary }]}
                      >
                        {t.screenshot_urls.length === 1
                          ? '1 screenshot'
                          : `${t.screenshot_urls.length} screenshots`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </Pressable>
            ))}
          </SettingsGroup>
        ) : null}
      </KeyboardScrollView>

      <ActionSheet
        visible={sourceOpen}
        title="Add a screenshot"
        onClose={() => setSourceOpen(false)}
        options={[
          {
            label: 'Choose from gallery',
            icon: <ImageIcon size={22} color={colors.text} />,
            onPress: () => pickShot('library'),
          },
          {
            label: 'Take photo',
            icon: <Camera size={22} color={colors.text} />,
            onPress: () => pickShot('camera'),
          },
        ]}
      />
    </SafeAreaView>
  );
}

function ShotTile({
  shot,
  onRetry,
  onRemove,
}: {
  shot: Screenshot;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { colors } = useAppTheme();
  const failed = shot.status === 'error';
  return (
    <View style={styles.tileWrap}>
      <Pressable
        onPress={failed ? onRetry : undefined}
        disabled={!failed}
        accessibilityRole={failed ? 'button' : 'image'}
        accessibilityLabel={
          failed ? `Upload failed: ${shot.error}. Tap to retry` : 'Screenshot'
        }
        style={[styles.tile, { backgroundColor: colors.surfaceAlt }]}
      >
        <Image source={{ uri: shot.media.uri }} style={styles.tileImage} />
        {shot.status === 'uploading' ? (
          <View style={[styles.tileOverlay, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.tileProgress}>
              {Math.round(shot.progress * 100)}%
            </Text>
          </View>
        ) : failed ? (
          <View style={[styles.tileOverlay, styles.tileFailed]}>
            <RotateCw size={18} color="#FFFFFF" />
            <Text style={styles.tileProgress}>Retry</Text>
          </View>
        ) : (
          <View style={[styles.tileDone, { backgroundColor: colors.success }]}>
            <Check size={11} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Remove screenshot"
        style={({ pressed }) => [
          styles.tileRemove,
          { backgroundColor: colors.text, borderColor: colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <X size={12} color={colors.surface} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

export function ContactSentScreen({
  navigation,
  route,
}: ScreenProps<'ContactSent'>) {
  const { colors } = useAppTheme();
  const { ticket } = route.params;
  useStatusBar();

  /** Opens this request with Contact us under it, so Back lands on the list. */
  const openRequest = () =>
    navigation.dispatch(state => {
      const routes = state.routes.slice(0, -1);
      return CommonActions.reset({
        ...state,
        routes: [
          ...routes,
          { key: `ContactUs-${ticket.id}`, name: 'ContactUs' },
          { key: `SupportTicket-${ticket.id}`, name: 'SupportTicket', params: { ticket } },
        ],
        index: routes.length + 1,
      });
    });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.done}>
        <View style={[styles.doneCheck, { backgroundColor: colors.successSoft }]}>
          <Check size={44} color={colors.success} strokeWidth={2.6} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.text }]}>
          Thanks — we got it
        </Text>
        <Text style={[styles.doneText, { color: colors.textSecondary }]}>
          Your request{' '}
          <Text style={[styles.reference, { color: colors.text }]}>
            #{ticket.reference}
          </Text>{' '}
          is with our support team. We usually reply within 24 hours.
        </Text>
        <View style={styles.doneActions}>
          <Button title="View request" onPress={openRequest} />
          <Button
            title="Done"
            variant="ghost"
            onPress={() => navigation.goBack()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontSize: 18, fontWeight: '800' },
  headText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  textarea: { minHeight: 120 },
  label: { fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
  optional: { fontWeight: '500' },
  reference: { fontWeight: '800' },
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  dropTitle: { fontSize: 14, fontWeight: '700' },
  dropSub: { fontSize: 12 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  count: { fontSize: 12.5, fontWeight: '600' },
  shotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 6,
  },
  tileWrap: { position: 'relative' },
  tile: {
    width: TILE_WIDTH,
    height: Math.round((TILE_WIDTH * 4) / 3),
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  addTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileImage: { width: '100%', height: '100%' },
  tileOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tileFailed: { backgroundColor: 'rgba(220, 38, 38, 0.72)' },
  tileProgress: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  tileDone: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRemove: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldError: { fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  formError: { marginTop: spacing.md },
  submit: { marginTop: spacing.md },
  pressed: { opacity: 0.7 },
  ticket: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: spacing.md,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketTitle: { flexShrink: 1, fontSize: 14.5, fontWeight: '700' },
  ticketMeta: { fontSize: 12, marginTop: 2 },
  ticketBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  ticketAttach: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  doneCheck: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: { fontSize: 22, fontWeight: '800' },
  doneText: { fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  doneActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
