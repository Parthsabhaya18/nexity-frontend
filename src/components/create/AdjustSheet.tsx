import { Minus, Plus, X } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import {
  type Adjustments,
  ZERO_ADJUSTMENTS,
} from '@/features/create/adjustments';
import { spacing, useAppTheme } from '@/theme';

const ROWS: {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
];

type Props = {
  visible: boolean;
  value: Adjustments;
  onChange: (next: Adjustments) => void;
  onClose: () => void;
};

/** Photo looks. The same numbers are saved and shown to everyone. */
export function AdjustSheet({ visible, value, onChange, onClose }: Props) {
  const { colors } = useAppTheme();
  const step = (
    key: keyof Adjustments,
    min: number,
    max: number,
    delta: number,
  ) => {
    const next = Math.min(max, Math.max(min, value[key] + delta));
    onChange({ ...value, [key]: next });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Edit look</Text>
          <IconButton onPress={onClose} accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </IconButton>
        </View>
        <ScrollView>
          {ROWS.map(row => (
            <View key={row.key} style={styles.row}>
              <Text style={[styles.label, { color: colors.text }]}>
                {row.label}
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => step(row.key, row.min, row.max, -10)}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${row.label}`}
                  style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Minus size={18} color={colors.text} />
                </Pressable>
                <Text style={[styles.value, { color: colors.text }]}>
                  {Math.round(value[row.key])}
                </Text>
                <Pressable
                  onPress={() => step(row.key, row.min, row.max, 10)}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${row.label}`}
                  style={[styles.btn, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Plus size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable
            onPress={() => onChange(ZERO_ADJUSTMENTS)}
            accessibilityRole="button"
            style={styles.reset}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              Reset
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    minHeight: 54,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  label: { fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { width: 42, textAlign: 'center', fontWeight: '800' },
  reset: { alignSelf: 'center', padding: 16 },
});
