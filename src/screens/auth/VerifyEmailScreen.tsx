import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AuthHeader } from '@/components/ui/AuthHeader';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Banner } from '@/components/ui/Banner';
import { Button, LinkButton } from '@/components/ui/Button';
import { DevCodeHint } from '@/components/ui/DevCodeHint';
import { OtpInput } from '@/components/ui/OtpInput';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ScreenProps } from '@/navigation/types';
import { authApi } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { spacing, useAppTheme } from '@/theme';

const CODE_LENGTH = 6;
const DEFAULT_COOLDOWN = 30;

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VerifyEmailScreen({
  navigation,
  route,
}: ScreenProps<'VerifyEmail'>) {
  const { email, mode } = route.params;
  const { colors, scheme } = useAppTheme();
  const { signIn } = useAuth();

  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(route.params.devCode);
  const [cooldown, setCooldown] = useState(
    route.params.resendIn ?? DEFAULT_COOLDOWN,
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const lastSubmitted = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || submitting) return;
      lastSubmitted.current = value;
      Keyboard.dismiss();
      setSubmitting(true);
      setError(null);
      setInfo(null);
      try {
        if (mode === 'register') {
          const session = await authApi.verifyEmail(email, value);
          setVerified(true);
          setTimeout(() => signIn(session), 900);
        } else {
          const { reset_token } = await authApi.verifyResetCode(email, value);
          navigation.replace('ResetPassword', {
            email,
            resetToken: reset_token,
          });
        }
      } catch (err) {
        setCode('');
        if (err instanceof ApiError) {
          const attemptsLeft = (
            err.details as { attempts_left?: number } | undefined
          )?.attempts_left;
          setError(
            err.code === 'INVALID_CODE' &&
              typeof attemptsLeft === 'number' &&
              attemptsLeft > 0
              ? `${err.message} ${attemptsLeft} ${
                  attemptsLeft === 1 ? 'attempt' : 'attempts'
                } left.`
              : err.message,
          );
        } else {
          setError('Something went wrong. Please try again.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [email, mode, navigation, signIn, submitting],
  );

  const onChangeCode = (value: string) => {
    setCode(value);
    if (error) setError(null);
    if (value.length === CODE_LENGTH && value !== lastSubmitted.current)
      submit(value);
    if (value.length < CODE_LENGTH) lastSubmitted.current = null;
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res =
        mode === 'register'
          ? await authApi.resendVerification(email)
          : await authApi.forgotPassword(email);
      setCooldown(res.resend_available_in || DEFAULT_COOLDOWN);
      setDevCode(res.dev_code);
      setCode('');
      lastSubmitted.current = null;
      setInfo(`We sent a new code to ${email}.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESEND_COOLDOWN') {
        const retry = (
          err.details as { retry_after_seconds?: number } | undefined
        )?.retry_after_seconds;
        if (retry) setCooldown(retry);
      }
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <AuthLayout>
        <View style={styles.center}>
          <View style={[styles.done, { backgroundColor: colors.successSoft }]}>
            <Text style={[styles.doneIcon, { color: colors.success }]}>✓</Text>
          </View>
          <Text style={[styles.doneTitle, { color: colors.text }]}>
            Email verified
          </Text>
          <Text style={[styles.doneText, { color: colors.textSecondary }]}>
            Taking you to Nexity…
          </Text>
        </View>
      </AuthLayout>
    );
  }

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
        title={mode === 'register' ? 'Check your email' : 'Enter reset code'}
        subtitle={
          <>
            We sent a {CODE_LENGTH}-digit code to{' '}
            <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
          </>
        }
      />

      {error ? <Banner tone="error" message={error} /> : null}
      {info ? <Banner tone="success" message={info} /> : null}

      <OtpInput
        value={code}
        onChange={onChangeCode}
        error={!!error}
        disabled={submitting}
      />
      <DevCodeHint code={devCode} onFill={onChangeCode} />

      <Button
        title="Verify"
        loadingTitle="Verifying…"
        onPress={() => submit(code)}
        loading={submitting}
        disabled={code.length !== CODE_LENGTH}
        style={styles.submit}
      />

      <View style={styles.resend}>
        <Text style={[styles.resendText, { color: colors.textSecondary }]}>
          Didn’t get it?{' '}
        </Text>
        {cooldown > 0 ? (
          <Text style={[styles.resendText, { color: colors.textSecondary }]}>
            Resend in {formatCountdown(cooldown)}
          </Text>
        ) : (
          <LinkButton
            title={resending ? 'Sending…' : 'Resend code'}
            strong
            onPress={resend}
            disabled={resending}
          />
        )}
      </View>
      <Text style={[styles.spam, { color: colors.textSecondary }]}>
        Check your spam folder if it isn’t in your inbox.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logo: { marginBottom: spacing.xl },
  email: { fontWeight: '700' },
  submit: { marginTop: spacing.lg },
  resend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: { fontSize: 14 },
  spam: { fontSize: 12.5, textAlign: 'center', marginTop: spacing.sm },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  done: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneIcon: { fontSize: 34, fontWeight: '800' },
  doneTitle: { fontSize: 24, fontWeight: '800', marginTop: spacing.md },
  doneText: { fontSize: 15, marginTop: 6 },
});
