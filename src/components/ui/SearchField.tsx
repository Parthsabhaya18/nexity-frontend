import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  style?: ViewStyle;
};

export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: focused ? colors.surface : colors.inputBackground,
          borderColor: focused ? colors.primary : colors.border,
        },
        style,
      ]}
    >
      <Search size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
