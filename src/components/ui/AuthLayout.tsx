import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useAppTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Shows a back button in the top-left corner. */
  onBack?: () => void;
};

export function AuthLayout({ children, onBack }: Props) {
  const { scheme, colors } = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {onBack ? (
          <View style={styles.topBar}>
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.back,
                pressed && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            !onBack && styles.contentNoBar,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 36, lineHeight: 38, fontWeight: '300' },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  contentNoBar: { paddingTop: spacing.xl, justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center' },
});
