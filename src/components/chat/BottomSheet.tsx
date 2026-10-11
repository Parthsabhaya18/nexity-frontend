import { X } from 'lucide-react-native';
import { type ReactNode, type RefObject, useEffect } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { SheetScrollProvider, useSheetDrag, useSheetHandle } from '@/components/ui/sheetDrag';
import { useAppTheme } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Replaces the plain title (e.g. an album dropdown). */
  header?: ReactNode;
  /** Right side of the header; defaults to a close button. */
  headerRight?: ReactNode;
  /** Fraction of the window height; omit to size to content. */
  height?: number;
  children: ReactNode;
  /** Inner list offset. A downward drag closes only while this is at the top. */
  scrollOffset?: RefObject<number>;
  /** Downward drag from the top. Defaults to `onClose`. */
  onDragDown?: () => void;
  /** Upward drag while the sheet is not full. */
  onDragUp?: () => void;
  contentScrolls?: boolean;
};

/** Slide-up modal sheet used by chat pickers and menus. */
export function BottomSheet({
  visible,
  onClose,
  title,
  header,
  headerRight,
  height,
  children,
  onDragDown,
  onDragUp,
  contentScrolls = true,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const showHead = Boolean(title || header);
  const drag = useSheetDrag({ onClose, onDragDown, onDragUp, contentScrolls });
  useEffect(() => {
    if (visible) drag.dragY.setValue(0);
  }, [visible, drag.dragY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.layer}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          {...drag.panHandlers}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              paddingBottom: insets.bottom,
              transform: [{ translateY: drag.dragY }],
            },
            height
              ? { height: Math.round(window.height * height) }
              : { maxHeight: window.height - insets.top - 24 },
          ]}
        >
          <SheetScrollProvider value={drag.value}>
          <SheetGrabber color={colors.border} />
          {showHead ? (
            <View style={[styles.head, { borderBottomColor: colors.border }]}>
              {header ?? (
                <Text
                  style={[styles.title, { color: colors.text }]}
                  accessibilityRole="header"
                  numberOfLines={1}
                >
                  {title}
                </Text>
              )}
              <View style={styles.right}>
                {headerRight ?? (
                  <IconButton onPress={onClose} accessibilityLabel="Close">
                    <X size={22} color={colors.text} />
                  </IconButton>
                )}
              </View>
            </View>
          ) : null}
          {children}
          </SheetScrollProvider>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetGrabber({ color }: { color: string }) {
  const handle = useSheetHandle();
  return (
    <View {...handle} style={styles.grabberZone}>
      <View style={[styles.grabber, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  grabberZone: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10 },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 4,
  },
  head: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '800' },
  right: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
