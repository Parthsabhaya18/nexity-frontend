import { StyleSheet, Text, View } from 'react-native';

import { inr } from '@/features/payments/format';
import { radius, useAppTheme } from '@/theme';

type Size = 'lg' | 'md' | 'sm';

/** Selling price with the list price struck through whenever it is higher. */
export function PlanPrice({
  amountPaise,
  mrpPaise,
  unit,
  size = 'md',
}: {
  amountPaise: number;
  mrpPaise?: number | null;
  unit?: string;
  size?: Size;
}) {
  const { colors } = useAppTheme();
  const showStrike = !!mrpPaise && mrpPaise > amountPaise && amountPaise > 0;
  const save = showStrike ? Math.round((1 - amountPaise / mrpPaise) * 100) : 0;
  const type = SIZE[size];

  return (
    <View
      style={styles.row}
      accessibilityLabel={
        showStrike
          ? `${inr(amountPaise)}${unit ? ` ${unit}` : ''}, was ${inr(mrpPaise)}${save ? `, save ${save} percent` : ''}`
          : `${inr(amountPaise)}${unit ? ` ${unit}` : ''}`
      }
    >
      <Text style={[styles.amount, { color: colors.text, fontSize: type.amount }]}>{inr(amountPaise)}</Text>
      {unit ? (
        <Text style={[styles.unit, { color: colors.textSecondary, fontSize: type.unit }]}>{unit}</Text>
      ) : null}
      {showStrike ? (
        <Text
          style={[styles.mrp, { color: colors.textSecondary, fontSize: type.mrp }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {inr(mrpPaise)}
        </Text>
      ) : null}
      {save > 0 ? (
        <View style={[styles.save, { backgroundColor: colors.successSoft }]}>
          <Text style={[styles.saveText, { color: colors.success }]}>Save {save}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const SIZE: Record<Size, { amount: number; unit: number; mrp: number }> = {
  lg: { amount: 32, unit: 14, mrp: 16 },
  md: { amount: 28, unit: 13, mrp: 15 },
  sm: { amount: 14, unit: 12, mrp: 13 },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  amount: { fontWeight: '800' },
  unit: { fontWeight: '600' },
  mrp: { textDecorationLine: 'line-through', fontWeight: '600' },
  save: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'center' },
  saveText: { fontSize: 11.5, fontWeight: '800' },
});
