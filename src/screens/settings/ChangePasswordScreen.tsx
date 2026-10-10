import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Keyboard,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';

import { NoteCard, settingsStyles } from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { KeyboardScrollView } from '@/components/ui/KeyboardScrollView';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyServerErrors } from '@/features/auth/formErrors';
import {
  type ChangePasswordForm,
  changePasswordSchema,
} from '@/features/auth/schemas';
import { tokenStore } from '@/features/auth/tokenStore';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { usersApi } from '@/services/api/users';
import { radius, spacing, useAppTheme } from '@/theme';

export function ChangePasswordScreen({
  navigation,
}: ScreenProps<'ChangePassword'>) {
  const { colors } = useAppTheme();
  const { refreshUser, signOut } = useAuth();
  const toast = useToast();
  const newRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  useStatusBar();

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ current, password }) => {
    Keyboard.dismiss();
    setFormError(null);
    try {
      const tokens = await usersApi.changePassword(current, password);
      await tokenStore.setTokens(tokens);
      await refreshUser().catch(() => {});
      navigation.goBack();
      toast.success('Password changed. Other devices were logged out.');
    } catch (err) {
      setFormError(
        applyServerErrors(err, setError, {
          current_password: 'current',
          new_password: 'password',
        }),
      );
    }
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Change password" back />
      <KeyboardScrollView contentContainerStyle={settingsStyles.content}>
        {formError ? <Banner tone="error" message={formError} /> : null}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Controller
            control={control}
            name="current"
            render={({ field }) => (
              <TextField
                label="Current password"
                placeholder="Your current password"
                password
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.current?.message}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => newRef.current?.focus()}
                autoFocus
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                ref={newRef}
                label="New password"
                placeholder="At least 8 characters, with a letter and a number"
                password
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.password?.message}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            )}
          />
          <PasswordStrength password={watch('password')} />
          <Controller
            control={control}
            name="confirm"
            render={({ field }) => (
              <TextField
                ref={confirmRef}
                label="Confirm new password"
                placeholder="Type it again"
                password
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.confirm?.message}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                returnKeyType="done"
                onSubmitEditing={() => onSubmit()}
              />
            )}
          />
          <Button
            title="Update password"
            loadingTitle="Updating…"
            onPress={onSubmit}
            loading={isSubmitting}
          />
          <View style={styles.forgot}>
            <LinkButton
              title="Forgot your password?"
              onPress={() => setForgot(true)}
            />
          </View>
        </View>
        <NoteCard icon={ShieldCheck}>
          Changing your password logs you out on every other device. You stay
          logged in here.
        </NoteCard>
      </KeyboardScrollView>

      <ConfirmDialog
        visible={forgot}
        title="Reset your password?"
        message="You'll be logged out. On the login screen, tap “Forgot password?” to get a reset code by email."
        confirmLabel="Log out"
        onCancel={() => setForgot(false)}
        onConfirm={() => {
          setForgot(false);
          signOut();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  forgot: { alignItems: 'center', marginTop: spacing.md },
});
