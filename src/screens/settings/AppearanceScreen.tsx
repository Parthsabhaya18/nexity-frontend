import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/ui/AppBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/services/api/client';
import type { Me } from '@/services/api/auth';
import { usersApi } from '@/services/api/users';
import { moodPalettes, type Mood, radius, spacing, useAppTheme } from '@/theme';
import { useStatusBar } from '@/navigation/useStatusBar';

const THEMES: { id: Me['preferences']['theme']; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System default' },
];

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'romantic', emoji: '❤️', label: 'Romantic' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😡', label: 'Angry' },
  { id: 'cool', emoji: '😎', label: 'Cool' },
  { id: 'relaxed', emoji: '🌿', label: 'Relaxed' },
  { id: 'excited', emoji: '🔥', label: 'Excited' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'motivated', emoji: '🤩', label: 'Motivated' },
];

export function AppearanceScreen() {
  const { colors } = useAppTheme();
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  useStatusBar();
  if (!user) return null;
  const mood = user.preferences.mood;

  const apply = async (body: {
    theme?: Me['preferences']['theme'];
    mood?: Mood | null;
  }) => {
    if (busy) return;
    const previous = user.preferences;
    const next = {
      theme: body.theme ?? previous.theme,
      mood: body.mood === undefined ? previous.mood : body.mood,
    };
    await updateUser({ ...user, preferences: next });
    setBusy(true);
    try {
      const saved = await usersApi.updatePreferences(
        body.theme ? { theme: body.theme } : { mood: body.mood ?? null },
      );
      await updateUser({
        ...user,
        preferences: { theme: saved.theme, mood: saved.mood },
      });
    } catch (err) {
      await updateUser({ ...user, preferences: previous });
      Alert.alert(
        "Couldn't save theme",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Theme" back />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <View style={styles.segment}>
          {THEMES.map(t => {
            const on = !mood && user.preferences.theme === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => apply({ theme: t.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: on ? colors.primary : colors.surfaceAlt,
                    borderColor: on ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: on ? colors.onButton : colors.text,
                    fontWeight: '700',
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {mood
            ? 'Off while a mood is on. Pick one to remove the mood.'
            : 'System default follows your phone.'}
        </Text>

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Mood
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {mood
            ? `${
                MOODS.find(m => m.id === mood)?.label
              } replaces Light, Dark and System.`
            : 'No mood. Tap again to remove it.'}
        </Text>
        <View style={styles.grid}>
          {MOODS.map(m => {
            const on = mood === m.id;
            const palette = moodPalettes[m.id];
            return (
              <Pressable
                key={m.id}
                onPress={() => apply({ mood: on ? null : m.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  styles.mood,
                  {
                    backgroundColor: palette.background,
                    borderColor: on ? colors.primary : palette.border,
                  },
                ]}
              >
                <Text style={styles.emoji}>{m.emoji}</Text>
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  section: {
    marginTop: spacing.lg,
    marginBottom: 8,
    fontWeight: '800',
    fontSize: 13,
  },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  help: { fontSize: 12.5, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mood: {
    width: '31%',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  emoji: { fontSize: 22 },
});
