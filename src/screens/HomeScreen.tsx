import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { env } from '@/config/env';
import { getHealth, type HealthResponse } from '@/services/api/health';
import { colors, spacing } from '@/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

export function HomeScreen() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ok', data: await getHealth() });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BrandLogo width={196} />
      <Text style={styles.title}>Welcome to Nexity</Text>
      <Text style={styles.subtitle}>
        Running on a physical device ({env.isDev ? 'development' : 'production'}
        )
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend connection</Text>
        <Text style={styles.muted}>{env.apiBaseUrl}</Text>

        {state.kind === 'loading' && (
          <ActivityIndicator style={styles.status} color={colors.primary} />
        )}
        {state.kind === 'ok' && (
          <Text style={[styles.status, styles.success]}>
            Connected · {state.data.environment} · up{' '}
            {Math.round(state.data.uptime)}s
          </Text>
        )}
        {state.kind === 'error' && (
          <Text style={[styles.status, styles.error]}>
            {state.message}
            {env.isDev ? '\nIs the backend running? Did you run "npm run reverse"?' : ''}
          </Text>
        )}

        <Pressable style={styles.button} onPress={check}>
          <Text style={styles.buttonText}>Check again</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: { marginTop: spacing.lg, fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  muted: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 12 },
  status: { marginTop: spacing.md },
  success: { color: colors.success, fontWeight: '600' },
  error: { color: colors.danger },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
