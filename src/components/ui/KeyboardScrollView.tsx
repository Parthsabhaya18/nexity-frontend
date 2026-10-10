import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

/** Space kept between the focused input and the top of the keyboard. */
const KEYBOARD_GAP = 96;

type Props = Omit<ScrollViewProps, 'children'> & { children: ReactNode };

/**
 * Scroll view for forms: shrinks above the keyboard and scrolls the focused
 * input into view, including multiline fields that grow while typing.
 */
export function KeyboardScrollView({
  children,
  contentContainerStyle,
  onScroll,
  ...rest
}: Props) {
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
    }, 120);
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
    // Edge-to-edge Android no longer resizes the window for the keyboard.
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        {...rest}
        onScroll={e => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        contentContainerStyle={keyboardOpen && styles.keyboardPad}
      >
        <View style={contentContainerStyle} onFocus={revealFocusedInput}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  keyboardPad: { paddingBottom: KEYBOARD_GAP },
});
