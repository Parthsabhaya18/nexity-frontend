import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Keyboard,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { type LoginForm, loginSchema } from '@/features/auth/schemas';
import { useSubmitLock } from '@/features/auth/useSubmitLock';
import type { ScreenProps } from '@/navigation/types';
import { authApi } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { spacing, useAppTheme } from '@/theme';

export function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { colors, scheme } = useAppTheme();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const submit = useSubmitLock();
  const failedAttempt = useRef<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const notice = route.params?.notice;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: route.params?.email ?? '', password: '' },
  });

  const [identifier, password] = watch(['identifier', 'password']);
  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  const showError = (message: string | null) => {
    setFormError(current => (current === message ? current : message));
  };

  const onSubmit = () => {
    const key = `${identifier.trim()}\0${password}`;
    if (failedAttempt.current === key) return;
    submit(() =>
      handleSubmit(async values => {
        const submitted = `${values.identifier.trim()}\0${values.password}`;
        Keyboard.dismiss();
        if (notice) navigation.setParams({ notice: undefined });
        try {
          const session = await authApi.login(
            values.identifier.trim(),
            values.password,
          );
          failedAttempt.current = null;
          await signIn(session);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
            const details = (err.details ?? {}) as {
              email?: string;
              resend_available_in?: number;
              dev_code?: string;
            };
            failedAttempt.current = null;
            showError(null);
            navigation.navigate('VerifyEmail', {
              email: details.email ?? values.identifier.trim(),
              mode: 'register',
              resendIn: details.resend_available_in,
              devCode: details.dev_code,
            });
            return;
          }
          failedAttempt.current = err instanceof ApiError ? submitted : null;
          showError(
            err instanceof ApiError
              ? err.message
              : 'Something went wrong. Please try again.',
          );
        }
      })(),
    );
  };

  return (
    <AuthLayout>
      <AuthHeader
        top={
          <BrandLogo
            variant="horizontal"
            width={150}
            scheme={scheme}
            style={styles.logo}
          />
        }
        title="Welcome back"
        subtitle="Log in to continue to Nexity."
      />

      {notice ? <Banner tone="success" message={notice} /> : null}
      {formError ? <Banner tone="error" message={formError} /> : null}

      <Controller
        control={control}
        name="identifier"
        render={({ field }) => (
          <TextField
            label="Email or username"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={text => {
              field.onChange(text);
              failedAttempt.current = null;
              if (formError) showError(null);
            }}
            onBlur={field.onBlur}
            error={errors.identifier?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            ref={passwordRef}
            label="Password"
            placeholder="Your password"
            password
            value={field.value}
            onChangeText={text => {
              field.onChange(text);
              failedAttempt.current = null;
              if (formError) showError(null);
            }}
            onBlur={field.onBlur}
            error={errors.password?.message}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && onSubmit()}
            editable={!isSubmitting}
          />
        )}
      />

      <View style={styles.forgot}>
        <LinkButton
          title="Forgot password?"
          onPress={() =>
            navigation.navigate('ForgotPassword', {
              email: identifier.includes('@') ? identifier.trim() : undefined,
            })
          }
        />
      </View>

      <Button
        title="Log in"
        loadingTitle="Logging in…"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={!canSubmit}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          New to Nexity?{' '}
        </Text>
        <LinkButton
          title="Create account"
          strong
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logo: { marginBottom: spacing.xl },
  forgot: { alignItems: 'flex-end', marginTop: -4, marginBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: { fontSize: 14 },
});
