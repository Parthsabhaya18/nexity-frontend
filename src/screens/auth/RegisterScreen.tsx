import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';

import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { Checkbox, ChoiceChips } from '@/components/ui/Choice';
import { DateField } from '@/components/ui/DateField';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { applyServerErrors } from '@/features/auth/formErrors';
import {
  EARLIEST_DOB,
  latestDob,
  type RegisterFormInput,
  type RegisterFormOutput,
  registerSchema,
  USERNAME_PATTERN,
} from '@/features/auth/schemas';
import type { ScreenProps } from '@/navigation/types';
import { authApi, type Gender } from '@/services/api/auth';
import { spacing, useAppTheme } from '@/theme';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { colors } = useAppTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const maxDob = useMemo(() => latestDob(), []);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      display_name: '',
      username: '',
      email: '',
      password: '',
      gender: undefined,
      dob: '',
      terms: false,
    },
  });

  const username = watch('username').trim().toLowerCase();
  const password = watch('password');

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.usernameAvailable(username);
        if (active) setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        if (active) setUsernameStatus('idle');
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username]);

  const onSubmit = handleSubmit(async values => {
    Keyboard.dismiss();
    setFormError(null);
    try {
      const res = await authApi.register({
        display_name: values.display_name,
        username: values.username,
        email: values.email,
        password: values.password,
        gender: values.gender,
        date_of_birth: values.dob,
        accept_terms: true,
      });
      navigation.navigate('VerifyEmail', {
        email: res.user.email,
        mode: 'register',
        resendIn: res.resend_available_in,
        devCode: res.dev_code,
      });
    } catch (err) {
      setFormError(
        applyServerErrors(err, setError, {
          date_of_birth: 'dob',
          accept_terms: 'terms',
        }),
      );
    }
  });

  const usernameError =
    errors.username?.message ??
    (usernameStatus === 'taken' ? 'That username is taken.' : undefined);

  return (
    <AuthLayout onBack={() => navigation.goBack()}>
      <AuthHeader
        title="Create your account"
        subtitle="It takes less than a minute."
      />

      {formError ? <Banner tone="error" message={formError} /> : null}

      <Controller
        control={control}
        name="display_name"
        render={({ field }) => (
          <TextField
            label="Full name"
            placeholder="Jane Doe"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.display_name?.message}
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
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
              usernameStatus === 'available'
                ? '✓ Available'
                : 'Lowercase letters, numbers, dots and underscores.'
            }
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="username-new"
            maxLength={30}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
            right={
              usernameStatus === 'checking' ? (
                <ActivityIndicator
                  size="small"
                  color={colors.textSecondary}
                  style={styles.adornment}
                />
              ) : usernameStatus === 'available' ? (
                <Text
                  style={[
                    styles.adornment,
                    styles.tick,
                    { color: colors.success },
                  ]}
                >
                  ✓
                </Text>
              ) : usernameStatus === 'taken' ? (
                <Text
                  style={[
                    styles.adornment,
                    styles.tick,
                    { color: colors.danger },
                  ]}
                >
                  ✗
                </Text>
              ) : null
            }
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            ref={emailRef}
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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
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
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
          />
        )}
      />
      <PasswordStrength password={password} />

      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <ChoiceChips
            label="Gender"
            options={GENDERS}
            value={field.value}
            onChange={field.onChange}
            error={errors.gender?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="dob"
        render={({ field }) => (
          <DateField
            label="Date of birth"
            placeholder="Select your date of birth"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.dob?.message}
            hint="Your birthday is never shown publicly."
            minimumDate={EARLIEST_DOB}
            maximumDate={maxDob}
            disabled={isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="terms"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={field.onChange}
            error={errors.terms?.message}
          >
            <Text style={[styles.terms, { color: colors.textSecondary }]}>
              I agree to the{' '}
              <Text
                style={[styles.termsLink, { color: colors.primary }]}
                onPress={() => Linking.openURL('https://nexity.com/terms')}
              >
                Terms
              </Text>{' '}
              and{' '}
              <Text
                style={[styles.termsLink, { color: colors.primary }]}
                onPress={() => Linking.openURL('https://nexity.com/privacy')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </Checkbox>
        )}
      />

      <Button
        title="Create account"
        loadingTitle="Creating account…"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={usernameStatus === 'taken'}
        style={styles.submit}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Already have an account?{' '}
        </Text>
        <LinkButton title="Log in" strong onPress={() => navigation.goBack()} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  adornment: { marginRight: 8 },
  tick: { fontSize: 17, fontWeight: '800' },
  terms: { fontSize: 14, lineHeight: 20 },
  termsLink: { fontWeight: '700' },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: { fontSize: 14 },
});
