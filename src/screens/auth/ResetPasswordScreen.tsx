import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Keyboard,
  StyleSheet,
  Text,
  type TextInputInstance,
} from 'react-native';

import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { applyServerErrors } from '@/features/auth/formErrors';
import {
  type NewPasswordForm,
  newPasswordSchema,
} from '@/features/auth/schemas';
import type { ScreenProps } from '@/navigation/types';
import { authApi } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { spacing, useAppTheme } from '@/theme';

export function ResetPasswordScreen({
  navigation,
  route,
}: ScreenProps<'ResetPassword'>) {
  const { email, resetToken } = route.params;
  const { colors } = useAppTheme();
  const confirmRef = useRef<TextInputInstance>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    Keyboard.dismiss();
    setFormError(null);
    try {
      await authApi.resetPassword(resetToken, password);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Login',
            params: {
              email,
              notice: 'Password updated. Log in with your new password.',
            },
          },
        ],
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_RESET_TOKEN') {
        setFormError(
          'This reset session has expired. Go back and request a new code.',
        );
        return;
      }
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout onBack={() => navigation.goBack()}>
      <AuthHeader
        icon="🔒"
        title="Create a new password"
        subtitle={
          <>
            For{' '}
            <Text style={[styles.email, { color: colors.text }]}>{email}</Text>.
            You’ll be logged out on all other devices.
          </>
        }
      />

      {formError ? <Banner tone="error" message={formError} /> : null}

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="New password"
            placeholder="At least 8 characters"
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
            autoFocus
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
            label="Confirm password"
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
        style={styles.submit}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  email: { fontWeight: '700' },
  submit: { marginTop: spacing.sm },
});
