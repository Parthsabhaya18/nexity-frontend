import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
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
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const showHead = Boolean(title || header);

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
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              paddingBottom: insets.bottom,
            },
            height
              ? { height: Math.round(window.height * height) }
              : { maxHeight: window.height - insets.top - 24 },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 8,
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
