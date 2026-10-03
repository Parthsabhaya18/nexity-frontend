import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fromIsoDate, toIsoDate } from '@/features/auth/schemas';
import { radius, spacing, useAppTheme } from '@/theme';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Locale-independent so it reads the same on every device (Hermes Intl varies). */
export function formatDisplayDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

type Props = {
  label: string;
  /** `YYYY-MM-DD` or empty string. */
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

export function DateField({
  label,
  value,
  onChange,
  onBlur,
  placeholder = 'Select date',
  error,
  hint,
  minimumDate,
  maximumDate,
  disabled,
}: Props) {
  const { scheme, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());

  const selected = value ? fromIsoDate(value) : null;
  // Start the wheel on the newest allowed date so 18+ users scroll back only a little.
  const initial = selected ?? maximumDate ?? new Date();

  const open = () => {
    if (disabled) return;
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(toIsoDate(date));
          onBlur?.();
        },
      });
      return;
    }

    setIosDraft(initial);
    setIosOpen(true);
  };

  const closeIos = (commit: boolean) => {
    if (commit) onChange(toIsoDate(iosDraft));
    setIosOpen(false);
    onBlur?.();
  };

  const borderColor = error ? colors.danger : colors.border;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}${
          selected ? `, ${formatDisplayDate(selected)}` : ''
        }`}
        accessibilityHint="Opens a date picker"
        style={({ pressed }) => [
          styles.box,
          {
            borderColor,
            backgroundColor: error ? colors.dangerSoft : colors.inputBackground,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.value,
            { color: selected ? colors.text : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {selected ? formatDisplayDate(selected) : placeholder}
        </Text>
        <CalendarDays size={20} color={colors.textSecondary} />
      </Pressable>
      {error ? (
        <Text
          style={[styles.message, { color: colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {hint}
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => closeIos(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => closeIos(false)}
            accessibilityLabel="Close date picker"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + spacing.sm,
              },
            ]}
          >
            <View
              style={[styles.sheetBar, { borderBottomColor: colors.border }]}
            >
              <Pressable
                onPress={() => closeIos(false)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.sheetAction, { color: colors.textSecondary }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {label}
              </Text>
              <Pressable
                onPress={() => closeIos(true)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.sheetAction,
                    styles.sheetDone,
                    { color: colors.primary },
                  ]}
                >
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant={scheme}
              onChange={(_, date) => date && setIosDraft(date)}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: 13.5, fontWeight: '700', marginBottom: 7 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  value: { flex: 1, fontSize: 15, marginRight: 8 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  message: { fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700' },
  sheetAction: { fontSize: 15, fontWeight: '600' },
  sheetDone: { fontWeight: '800' },
  iosPicker: { alignSelf: 'stretch' },
});
