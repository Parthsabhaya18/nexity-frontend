import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

import { LinkButton } from './Button';

/** Development only: the backend returns the code when it has no SMTP server to send it with. */
export function DevCodeHint({
  code,
  onFill,
}: {
  code?: string;
  onFill: (code: string) => void;
}) {
  const { colors } = useAppTheme();
  if (!__DEV__ || !code) return null;

  return (
    <View
      style={[
        styles.box,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Dev code:{' '}
        <Text style={[styles.code, { color: colors.text }]}>{code}</Text>
      </Text>
      <LinkButton title="Fill" strong onPress={() => onFill(code)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: spacing.md,
  },
  text: { fontSize: 13 },
  code: { fontWeight: '800', letterSpacing: 2 },
});
