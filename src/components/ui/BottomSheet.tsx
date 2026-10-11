import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScrollProvider, useSheetDrag, useSheetHandle } from '@/components/ui/sheetDrag';
import { radius, spacing, useAppTheme } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Lifts the sheet above the keyboard (for sheets with text inputs). */
  avoidKeyboard?: boolean;
  /** Extra styles for the sheet surface, e.g. a fixed height. */
  style?: ViewStyle;
  /** Hide the grab handle when the content draws its own (e.g. to make it draggable). */
  hideHandle?: boolean;
  /**
   * Inner list offset. A downward drag closes only while this is at the top,
   * so a scrolled list can still move back up.
   */
  scrollOffset?: RefObject<number>;
  /** False when the inner list is not scrolling (a half-open share sheet). */
  contentScrolls?: boolean;
  /** Downward drag from the top. Defaults to `onClose`. Share uses this to drop to half. */
  onDragDown?: () => void;
  /** Upward drag while the sheet is not full. Share uses this to open fully. */
  onDragUp?: () => void;
};

/**
 * Sheet that slides up from the bottom over a dimmed backdrop. Tapping the
 * backdrop or Android back closes it.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  avoidKeyboard,
  style,
  hideHandle,
  contentScrolls = true,
  onDragDown,
  onDragUp,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.5, 0],
  });
  const drag = useSheetDrag({ onClose, onDragDown, onDragUp, contentScrolls });
  const shift = Animated.add(translateY, drag.dragY);
  useEffect(() => {
    if (visible) drag.dragY.setValue(0);
  }, [visible, drag.dragY]);

  const Wrapper = avoidKeyboard ? KeyboardAvoidingView : View;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.backdrop,
          { backgroundColor: colors.overlay, opacity: progress },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Wrapper
        {...(avoidKeyboard ? { behavior: 'padding' as const } : {})}
        pointerEvents="box-none"
        style={styles.anchor}
      >
        <Animated.View
          {...drag.panHandlers}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              paddingBottom: insets.bottom + spacing.sm,
              transform: [{ translateY: shift }],
            },
            style,
          ]}
        >
          <SheetScrollProvider value={drag.value}>
            {hideHandle ? null : <SheetHandle color={colors.border} />}
            {children}
          </SheetScrollProvider>
        </Animated.View>
      </Wrapper>
    </Modal>
  );
}

function SheetHandle({ color }: { color: string }) {
  const handle = useSheetHandle();
  return (
    <View {...handle} style={styles.handleZone}>
      <View style={[styles.handle, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
  },
  handleZone: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing.sm },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
