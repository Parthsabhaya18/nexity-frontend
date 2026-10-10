import { Monitor, Moon, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Me } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';
import { usersApi } from '@/services/api/users';
import { moodPalettes, type Mood, radius, spacing, useAppTheme } from '@/theme';

const THEMES = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
] as const;

export const MOODS: { id: Mood; emoji: string; label: string }[] = [
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

export function themeLabel(preferences: Me['preferences']) {
  const mood = MOODS.find(m => m.id === preferences.mood);
  if (mood) return `${mood.emoji} ${mood.label}`;
  return preferences.theme === 'light'
    ? 'Light'
    : preferences.theme === 'dark'
    ? 'Dark'
    : 'System default';
}

/** Light / Dark / System plus the mood grid; saves right away and rolls back on failure. */
export function ThemePicker() {
  const { colors } = useAppTheme();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const mood = user.preferences.mood;

  const apply = async (body: {
    theme?: Me['preferences']['theme'];
    mood?: Mood | null;
  }) => {
    if (busy) return;
    const previous = user.preferences;
    await updateUser({
      ...user,
      preferences: {
        theme: body.theme ?? previous.theme,
        mood: body.theme ? null : body.mood === undefined ? previous.mood : body.mood,
      },
    });
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
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't save theme. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
      <Text style={[styles.help, { color: colors.textSecondary }]}>
        {mood
          ? 'Off while a mood is on · pick one to remove the mood'
          : 'Light, dark or match your device'}
      </Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {THEMES.map(({ id, label, Icon }) => {
          const on = !mood && user.preferences.theme === id;
          const fg = on ? colors.onButton : colors.text;
          return (
            <Pressable
              key={id}
              onPress={() => apply({ theme: id })}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: on }}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: on ? colors.primary : colors.surfaceAlt,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
            >
              <Icon size={16} color={fg} />
              <Text style={[styles.segmentText, { color: fg }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.title, styles.moodTitle, { color: colors.text }]}>
        Mood
      </Text>
      <Text style={[styles.help, { color: colors.textSecondary }]}>
        {mood
          ? `${MOODS.find(m => m.id === mood)?.label} · replaces Light/Dark/System · tap again to remove`
          : 'No mood · a mood replaces Light/Dark/System'}
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {MOODS.map(m => {
          const on = mood === m.id;
          const palette = moodPalettes[m.id];
          return (
            <Pressable
              key={m.id}
              onPress={() => apply({ mood: on ? null : m.id })}
              accessibilityRole="radio"
              accessibilityLabel={`${m.label} mood`}
              accessibilityState={{ checked: on }}
              style={[
                styles.mood,
                {
                  backgroundColor: palette.background,
                  borderColor: on ? colors.primary : palette.border,
                },
              ]}
            >
              <Text style={styles.emoji}>{m.emoji}</Text>
              <Text style={[styles.moodText, { color: palette.text }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.md },
  title: { fontSize: 15, fontWeight: '700' },
  moodTitle: { marginTop: spacing.lg },
  help: { fontSize: 12.5, lineHeight: 17, marginTop: 2, marginBottom: 10 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  segmentText: { fontWeight: '700', fontSize: 13.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mood: {
    width: '31%',
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  emoji: { fontSize: 22 },
  moodText: { fontWeight: '700', fontSize: 13 },
});
