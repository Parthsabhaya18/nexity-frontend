import { zodResolver } from '@hookform/resolvers/zod';
import { usePreventRemove } from '@react-navigation/native';
import { Camera, ImageIcon, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { AvatarPreview } from '@/components/profile/AvatarPreview';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Banner } from '@/components/ui/Banner';
import { LinkButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyServerErrors } from '@/features/auth/formErrors';
import {
  captureWithCamera,
  type LocalMedia,
  MediaError,
  pickFromLibrary,
} from '@/features/media/pickMedia';
import { useMediaUpload } from '@/features/media/useMediaUpload';
import {
  BIO_MAX,
  type ProfileFormInput,
  type ProfileFormOutput,
  profileSchema,
} from '@/features/profile/schemas';
import { useUsernameCheck } from '@/features/profile/useUsernameCheck';
import { mediaApi } from '@/services/api/media';
import { type ProfileUpdate, usersApi } from '@/services/api/users';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { spacing, useAppTheme } from '@/theme';

const AVATAR_SIZE = 96;

type AvatarChange =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  /** `mediaId` is set once the upload has finished. */
  | { kind: 'new'; uri: string; mediaId?: string };

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const { user, updateUser } = useAuth();
  const { colors } = useAppTheme();
  useStatusBar();

  const [avatar, setAvatar] = useState<AvatarChange>({ kind: 'unchanged' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const upload = useMediaUpload('avatar', { concurrency: 1 });
  /** Uploaded photos that are not on the profile yet; deleted if the edit is abandoned. */
  const unsaved = useRef(new Set<string>());

  const usernameRef = useRef<TextInputInstance>(null);
  const bioRef = useRef<TextInputInstance>(null);
  const websiteRef = useRef<TextInputInstance>(null);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user?.display_name ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
      website: user?.website ?? '',
      is_private: user?.is_private ?? false,
    },
  });

  const usernameStatus = useUsernameCheck(
    watch('username'),
    user?.username ?? '',
  );
  const bioLength = watch('bio').length;

  const dirty = isDirty || avatar.kind !== 'unchanged';
  const avatarPending = avatar.kind === 'new' && !avatar.mediaId;
  const canSave =
    dirty &&
    !avatarPending &&
    !upload.isUploading &&
    usernameStatus !== 'taken' &&
    !isSubmitting;

  useEffect(() => {
    const pending = unsaved.current;
    return () => {
      pending.forEach(id => mediaApi.remove(id).catch(() => {}));
    };
  }, []);

  useEffect(() => {
    if (saved) navigation.goBack();
  }, [saved, navigation]);

  usePreventRemove(dirty && !saved, ({ data }) => {
    Keyboard.dismiss();
    Alert.alert(
      'Discard changes?',
      "If you go back now, you'll lose the changes you made.",
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  if (!user) return null;

  const startAvatarUpload = async (media: LocalMedia) => {
    if (avatar.kind === 'new' && avatar.mediaId) {
      unsaved.current.delete(avatar.mediaId);
      mediaApi.remove(avatar.mediaId).catch(() => {});
    }
    setFormError(null);
    setAvatar({ kind: 'new', uri: media.uri });
    try {
      const [asset] = await upload.start([media]);
      unsaved.current.add(asset.id);
      setAvatar(current =>
        current.kind === 'new' && current.uri === media.uri
          ? { ...current, mediaId: asset.id }
          : current,
      );
    } catch {
      // The error is shown from `upload.items`.
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    try {
      const media =
        source === 'camera'
          ? await captureWithCamera('avatar', 'image')
          : (await pickFromLibrary('avatar'))[0];
      if (media) await startAvatarUpload(media);
    } catch (err) {
      Alert.alert(
        "Couldn't open photos",
        err instanceof MediaError ? err.message : 'Please try again.',
      );
    }
  };

  const removePhoto = () => {
    upload.reset();
    setAvatar(user.avatar_url ? { kind: 'removed' } : { kind: 'unchanged' });
  };

  const retryUpload = async () => {
    try {
      const [asset] = await upload.retryFailed();
      unsaved.current.add(asset.id);
      setAvatar(current =>
        current.kind === 'new' ? { ...current, mediaId: asset.id } : current,
      );
    } catch {
      // Shown from `upload.items`.
    }
  };

  const onSubmit = handleSubmit(async values => {
    Keyboard.dismiss();
    setFormError(null);
    const update: ProfileUpdate = {};
    if (values.display_name !== user.display_name)
      update.display_name = values.display_name;
    if (values.username !== user.username) update.username = values.username;
    if (values.bio.trim() !== user.bio) update.bio = values.bio.trim();
    if (values.website !== user.website) update.website = values.website;
    if (values.is_private !== user.is_private)
      update.is_private = values.is_private;
    if (avatar.kind === 'removed') update.avatar_media_id = null;
    if (avatar.kind === 'new' && avatar.mediaId)
      update.avatar_media_id = avatar.mediaId;

    try {
      const me = Object.keys(update).length
        ? await usersApi.updateMe(update)
        : user;
      if (update.avatar_media_id)
        unsaved.current.delete(update.avatar_media_id);
      await updateUser(me);
      setSaved(true);
    } catch (err) {
      setFormError(
        applyServerErrors(err, setError, { avatar_media_id: undefined }),
      );
    }
  });

  const previewUri =
    avatar.kind === 'new'
      ? avatar.uri
      : avatar.kind === 'removed'
      ? null
      : user.avatar_url;
  const hasPhoto = !!previewUri;
  const uploadItem = upload.items[0];
  const uploadError = uploadItem?.status === 'error' ? uploadItem.error : null;

  const usernameError =
    errors.username?.message ??
    (usernameStatus === 'taken'
      ? 'That username is taken. Try another.'
      : undefined);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
        >
          <Text style={[styles.headerText, { color: colors.text }]}>
            Cancel
          </Text>
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          Edit profile
        </Text>
        <Pressable
          onPress={() => onSubmit()}
          disabled={!canSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: isSubmitting }}
          style={({ pressed }) => [
            styles.headerBtn,
            styles.headerRight,
            pressed && styles.pressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.headerText,
                styles.done,
                { color: canSave ? colors.primary : colors.textSecondary },
              ]}
            >
              Done
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.avatarBlock}>
            <Pressable
              onPress={() =>
                hasPhoto ? setPhotoOpen(true) : setSheetOpen(true)
              }
              accessibilityRole="button"
              accessibilityLabel={
                hasPhoto ? 'View profile photo' : 'Add profile photo'
              }
              disabled={isSubmitting}
            >
              <Avatar
                uri={previewUri}
                name={user.display_name}
                size={AVATAR_SIZE}
              />
              {upload.isUploading ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={colors.onButton} />
                  <Text style={[styles.progress, { color: colors.onButton }]}>
                    {Math.round(upload.progress * 100)}%
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <LinkButton
              title={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
              onPress={() => setSheetOpen(true)}
              strong
              disabled={isSubmitting}
            />
          </View>

          {uploadError ? (
            <View style={styles.uploadError}>
              <Banner tone="error" message={uploadError} />
              <LinkButton title="Try again" onPress={retryUpload} strong />
            </View>
          ) : null}
          {formError ? <Banner tone="error" message={formError} /> : null}

          <Controller
            control={control}
            name="display_name"
            render={({ field }) => (
              <TextField
                label="Name"
                placeholder="Your name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.display_name?.message}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
                maxLength={50}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => usernameRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <TextField
                ref={usernameRef}
                label="Username"
                placeholder="jane.doe"
                value={field.value}
                onChangeText={t =>
                  field.onChange(t.toLowerCase().replace(/\s/g, ''))
                }
                onBlur={field.onBlur}
                error={usernameError}
                hint={
                  usernameStatus === 'available' ? '✓ Available' : undefined
                }
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="username-new"
                maxLength={30}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => bioRef.current?.focus()}
                right={
                  usernameStatus === 'checking' ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                      style={styles.adornment}
                    />
                  ) : null
                }
              />
            )}
          />

          <Controller
            control={control}
            name="bio"
            render={({ field }) => (
              <TextField
                ref={bioRef}
                label="Bio"
                placeholder="Tell people a little about you"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.bio?.message}
                hint={`${bioLength}/${BIO_MAX}`}
                multiline
                maxLength={BIO_MAX}
                textAlignVertical="top"
                style={styles.bio}
              />
            )}
          />

          <Controller
            control={control}
            name="website"
            render={({ field }) => (
              <TextField
                ref={websiteRef}
                label="Website"
                placeholder="example.com"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.website?.message}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="URL"
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            )}
          />

          <Controller
            control={control}
            name="is_private"
            render={({ field }) => (
              <View
                style={[
                  styles.privacy,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.privacyText}>
                  <Text style={[styles.privacyTitle, { color: colors.text }]}>
                    Private account
                  </Text>
                  <Text
                    style={[
                      styles.privacyHint,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Only people you approve can see your photos and videos.
                  </Text>
                </View>
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  accessibilityLabel="Private account"
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.onButton}
                  ios_backgroundColor={colors.border}
                />
              </View>
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <AvatarPreview
        visible={photoOpen}
        uri={previewUri}
        name={user.display_name}
        onClose={() => setPhotoOpen(false)}
      />
      <ActionSheet
        visible={sheetOpen}
        title="Profile photo"
        onClose={() => setSheetOpen(false)}
        options={[
          {
            label: 'Take photo',
            icon: <Camera size={22} color={colors.text} />,
            onPress: () => pick('camera'),
          },
          {
            label: 'Choose from library',
            icon: <ImageIcon size={22} color={colors.text} />,
            onPress: () => pick('library'),
          },
          ...(hasPhoto
            ? [
                {
                  label: 'Remove current photo',
                  icon: <Trash2 size={22} color={colors.danger} />,
                  destructive: true,
                  onPress: removePhoto,
                },
              ]
            : []),
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerText: { fontSize: 16 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  done: { fontWeight: '800' },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  avatarBlock: { alignItems: 'center', gap: 12, marginBottom: spacing.lg },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  uploadError: { alignItems: 'center', marginBottom: spacing.md },
  adornment: { marginHorizontal: 10 },
  bio: { minHeight: 84 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  privacyText: { flex: 1 },
  privacyTitle: { fontSize: 15, fontWeight: '700' },
  privacyHint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
