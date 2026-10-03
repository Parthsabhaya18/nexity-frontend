import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useAppTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Shows a back button in the top-left corner. */
  onBack?: () => void;
};

/** Space kept between the focused input and the top of the keyboard. */
const KEYBOARD_GAP = 120;

export function AuthLayout({ children, onBack }: Props) {
  const { scheme, colors } = useAppTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const revealFocusedInput = useCallback(() => {
    clearTimeout(revealTimer.current);
    // Wait for KeyboardAvoidingView to apply its padding before measuring.
    revealTimer.current = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const top = keyboardTop.current;
      if (!input || top == null) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + KEYBOARD_GAP - top;
        if (overlap > 0) {
          scrollRef.current?.scrollTo({
            y: scrollY.current + overlap,
            animated: true,
          });
        }
      });
    }, 100);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardOpen(true);
      revealFocusedInput();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardOpen(false);
    });
    return () => {
      show.remove();
      hide.remove();
      clearTimeout(revealTimer.current);
    };
  }, [revealFocusedInput]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {/* Edge-to-edge Android no longer resizes the window for the keyboard,
          so padding is needed on both platforms. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
          ref={scrollRef}
          onScroll={e => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            !onBack && styles.contentNoBar,
            keyboardOpen && styles.contentKeyboard,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner} onFocus={revealFocusedInput}>
            {children}
          </View>
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
  contentKeyboard: { paddingBottom: KEYBOARD_GAP },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center' },
});
