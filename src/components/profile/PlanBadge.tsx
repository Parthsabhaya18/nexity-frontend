import { Sparkles, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

/** Paid-plan mark. Rose spark for Premium, amber star for Plus — not a blue tick. */
export function PlanBadge({
  plan,
}: {
  plan?: 'plus' | 'premium' | 'free' | null;
}) {
  if (plan !== 'plus' && plan !== 'premium') return null;
  const premium = plan === 'premium';
  const Icon = premium ? Sparkles : Star;
  return (
    <View
      style={[styles.badge, { backgroundColor: premium ? '#BE185D' : '#B45309' }]}
      accessibilityLabel={premium ? 'Premium' : 'Plus'}
    >
      <Icon size={10} color="#FFFFFF" strokeWidth={2.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
