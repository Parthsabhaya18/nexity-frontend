import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, type ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Adds an eye / eye-off visibility toggle and starts hidden. */
  password?: boolean;
  right?: ReactNode;
};

export const TextField = forwardRef<TextInputInstance, Props>(
  function TextFieldImpl(
    { label, error, hint, password, right, style, onFocus, onBlur, ...input },
    ref,
  ) {
    const { colors } = useAppTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);

    const borderColor = error
      ? colors.danger
      : focused
      ? colors.primary
      : colors.border;

    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View
          style={[
            styles.box,
            {
              borderColor,
              backgroundColor: error
                ? colors.dangerSoft
                : colors.inputBackground,
            },
          ]}
        >
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            secureTextEntry={password ? hidden : input.secureTextEntry}
            accessibilityLabel={label}
            {...input}
            onFocus={e => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, { color: colors.text }, style]}
          />
          {right}
          {password ? (
            <Pressable
              onPress={() => setHidden(h => !h)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
              style={({ pressed }) => [
                styles.toggle,
                pressed && styles.pressed,
              ]}
            >
              {hidden ? (
                <Eye size={20} color={colors.textSecondary} />
              ) : (
                <EyeOff size={20} color={colors.primary} />
              )}
            </Pressable>
          ) : null}
        </View>
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
      </View>
    );
  },
);

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: 13.5, fontWeight: '700', marginBottom: 7 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 12, paddingRight: 8 },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  message: { fontSize: 12.5, marginTop: 6, lineHeight: 17 },
});
