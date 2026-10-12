import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { BrandLogo } from '@/components/BrandLogo';
import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { applyServerErrors } from '@/features/auth/formErrors';
import { type ForgotFormInput, forgotSchema } from '@/features/auth/schemas';
import { useSubmitLock } from '@/features/auth/useSubmitLock';
import type { ScreenProps } from '@/navigation/types';
import { authApi } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { spacing, useAppTheme } from '@/theme';

export function ForgotPasswordScreen({
  navigation,
  route,
}: ScreenProps<'ForgotPassword'>) {
  const { scheme } = useAppTheme();
  const submit = useSubmitLock();
  const failedAttempt = useRef<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormInput, unknown, z.output<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: route.params?.email ?? '' },
  });

  const showError = (message: string | null) => {
    setFormError(current => (current === message ? current : message));
  };

  const emailValue = watch('email');

  const onSubmit = () => {
    const key = emailValue.trim().toLowerCase();
    if (failedAttempt.current === key) return;
    submit(() =>
      handleSubmit(async ({ email }) => {
        Keyboard.dismiss();
        try {
          const res = await authApi.forgotPassword(email);
          failedAttempt.current = null;
          navigation.navigate('VerifyEmail', {
            email,
            mode: 'reset',
            resendIn: res.resend_available_in,
            devCode: res.dev_code,
          });
        } catch (err) {
          failedAttempt.current =
            err instanceof ApiError ? email.trim().toLowerCase() : null;
          showError(applyServerErrors(err, setError));
        }
      })(),
    );
  };

  return (
    <AuthLayout onBack={() => navigation.goBack()}>
      <AuthHeader
        top={
          <BrandLogo
            variant="horizontal"
            width={150}
            scheme={scheme}
            style={styles.logo}
          />
        }
        title="Forgot your password?"
        subtitle="Enter your email and we’ll send you a 6-digit code to reset it."
      />

      {formError ? <Banner tone="error" message={formError} /> : null}

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={text => {
              field.onChange(text);
              failedAttempt.current = null;
              if (formError) showError(null);
            }}
            onBlur={field.onBlur}
            error={errors.email?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => onSubmit()}
            editable={!isSubmitting}
          />
        )}
      />

      <Button
        title="Send code"
        loadingTitle="Sending…"
        onPress={onSubmit}
        loading={isSubmitting}
        style={styles.submit}
      />

      <View style={styles.footer}>
        <LinkButton
          title="Back to log in"
          onPress={() => navigation.goBack()}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logo: { marginBottom: spacing.xl },
  submit: { marginTop: spacing.sm },
  footer: { alignItems: 'center', marginTop: spacing.xl },
});
