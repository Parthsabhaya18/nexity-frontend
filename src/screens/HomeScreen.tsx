import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { radius, spacing, useAppTheme } from '@/theme';

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const { scheme, colors } = useAppTheme();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <BrandLogo variant="horizontal" width={140} scheme={scheme} />
        <Text style={[styles.title, { color: colors.text }]}>
          Hi, {user.display_name} 👋
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          You’re logged in to Nexity.
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Row label="Username" value={`@${user.username}`} />
          <Row label="Email" value={user.email} />
          <Row label="Email verified" value={user.is_verified ? 'Yes' : 'No'} />
        </View>

        <Button
          title="Log out"
          variant="secondary"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />
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
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', marginTop: spacing.xl },
  subtitle: { fontSize: 15, marginTop: 6 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.lg,
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
});
