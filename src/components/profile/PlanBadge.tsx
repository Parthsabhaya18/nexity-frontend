import { Crown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAppTheme } from '@/theme';

const SIZE = 18;
const LOBES = 16;

/** Scalloped seal. Valleys sit inside, curves bulge out to a rounded edge. */
function sealPath(size: number, lobes: number) {
  const cx = size / 2;
  const cy = size / 2;
  const valley = size * 0.36;
  const control = size * 0.64;
  let d = '';
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / lobes) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + valley * Math.cos(a0);
    const y0 = cy + valley * Math.sin(a0);
    const x1 = cx + control * Math.cos(a1);
    const y1 = cy + control * Math.sin(a1);
    const x2 = cx + valley * Math.cos(a2);
    const y2 = cy + valley * Math.sin(a2);
    d += i === 0 ? `M ${x0.toFixed(2)} ${y0.toFixed(2)}` : '';
    d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return `${d} Z`;
}

const SEAL = sealPath(SIZE, LOBES);

/** Premium mark. Plus and Free show nothing. */
export function PlanBadge({
  plan,
}: {
  plan?: 'plus' | 'premium' | 'free' | null;
}) {
  const { colors } = useAppTheme();
  if (plan !== 'premium') return null;
  return (
    <View style={styles.badge} accessibilityLabel="Premium">
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Path d={SEAL} fill={colors.button} />
      </Svg>
      <View style={styles.icon} pointerEvents="none">
        <Crown size={9} color={colors.onButton} fill={colors.onButton} strokeWidth={2.4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { position: 'absolute' },
});
