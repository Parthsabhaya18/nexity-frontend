import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { applyServerErrors } from '@/features/auth/formErrors';
import { type ForgotFormInput, forgotSchema } from '@/features/auth/schemas';
import type { ScreenProps } from '@/navigation/types';
import { authApi } from '@/services/api/auth';
import { spacing } from '@/theme';

export function ForgotPasswordScreen({
  navigation,
  route,
}: ScreenProps<'ForgotPassword'>) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormInput, unknown, z.output<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: route.params?.email ?? '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    Keyboard.dismiss();
    setFormError(null);
    try {
      const res = await authApi.forgotPassword(email);
      navigation.navigate('VerifyEmail', {
        email,
        mode: 'reset',
        resendIn: res.resend_available_in,
        devCode: res.dev_code,
      });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout onBack={() => navigation.goBack()}>
      <AuthHeader
        icon="🔑"
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
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => onSubmit()}
            autoFocus={!route.params?.email}
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
  submit: { marginTop: spacing.sm },
  footer: { alignItems: 'center', marginTop: spacing.xl },
});
