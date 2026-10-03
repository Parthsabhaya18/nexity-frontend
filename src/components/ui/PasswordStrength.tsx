import { StyleSheet, Text, View } from 'react-native';

import { passwordStrength } from '@/features/auth/schemas';
import { useAppTheme } from '@/theme';

const LABELS = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];

export function PasswordStrength({ password }: { password: string }) {
  const { colors } = useAppTheme();
  if (!password) return null;

  const score = passwordStrength(password);
  const tone =
    score <= 1 ? colors.danger : score === 2 ? '#C77A04' : colors.success;

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`Password strength: ${LABELS[score]}`}
    >
      <View style={styles.bars}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i < score ? tone : colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.text, { color: tone }]}>{LABELS[score]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  bars: { flex: 1, flexDirection: 'row', gap: 4, marginRight: 10 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  text: { fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right' },
});
