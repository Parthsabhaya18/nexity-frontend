import { useScrollToTop } from '@react-navigation/native';
import { Search, Users, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { useTabBarInset } from '@/navigation/BottomNav';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

export function SearchScreen() {
  const { colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  useScrollToTop(scrollRef);
  useStatusBar();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={[
            styles.box,
            {
              backgroundColor: focused
                ? colors.surface
                : colors.inputBackground,
              borderColor: focused ? colors.primary : colors.border,
            },
          ]}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search people"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel="Search people"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <EmptyState
          icon={<Users size={34} color={colors.primary} />}
          title="Find people on Nexity"
          text="Search by name or username to discover friends and follow them."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  box: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  content: { flexGrow: 1 },
});
