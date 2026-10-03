import { forwardRef, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';

import { radius, useAppTheme } from '@/theme';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
};

/**
 * One hidden text input behind visible digit boxes, so typing, deleting, pasting
 * and OS one-time-code autofill all work natively.
 */
export const OtpInput = forwardRef<TextInputInstance, Props>(
  function OtpInputImpl({ value, onChange, length = 6, error, disabled }, ref) {
    const { colors } = useAppTheme();
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<TextInputInstance | null>(null);

    return (
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityLabel={`${length}-digit code`}
        style={styles.row}
      >
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const active =
            focused &&
            (i === value.length ||
              (i === length - 1 && value.length === length));
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: error
                    ? colors.dangerSoft
                    : colors.inputBackground,
                  borderColor: error
                    ? colors.danger
                    : active
                    ? colors.primary
                    : colors.border,
                },
              ]}
            >
              <Text style={[styles.digit, { color: colors.text }]}>{char}</Text>
            </View>
          );
        })}
        <TextInput
          ref={node => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          value={value}
          onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          editable={!disabled}
          autoFocus
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.hidden}
          accessibilityLabel="Verification code"
        />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.86,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 24, fontWeight: '800' },
  hidden: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.011,
    color: 'transparent',
  },
});
