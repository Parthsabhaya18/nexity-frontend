import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useAppTheme();
  const [signingOut, setSigningOut] = useState(false);
  useStatusBar();

  if (!user) return null;

  const confirmSignOut = () =>
    Alert.alert(
      'Log out?',
      `You'll need to log in again as @${user.username}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ],
    );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Settings" back />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Account
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Row label="Username" value={`@${user.username}`} />
          <Row label="Email" value={user.email} />
          <Row label="Account" value={user.is_private ? 'Private' : 'Public'} />
        </View>

        <Pressable
          onPress={confirmSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.logout,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <LogOut size={20} color={colors.danger} />
          )}
          <Text style={[styles.logoutText, { color: colors.danger }]}>
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm },
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14 },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
