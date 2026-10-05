import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm label in `danger`, for Delete / Discard / Block. */
  destructive?: boolean;
  /** Shows a spinner on confirm and ignores taps while the action runs. */
  loading?: boolean;
  onConfirm: () => void;
  /** Cancel, backdrop tap and Android back. */
  onCancel: () => void;
};

/** Centered yes/no dialog themed with tokens (replaces `Alert.alert` for confirms). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const { colors } = useAppTheme();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });
  const cancel = () => {
    if (!loading) onCancel();
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.overlay, opacity: progress },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              opacity: progress,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.body}>
            <Text
              style={[styles.title, { color: colors.text }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {message ? (
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ busy: !!loading }}
            style={({ pressed }) => [
              styles.action,
              { borderTopColor: colors.border },
              pressed && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color={destructive ? colors.danger : colors.primary}
              />
            ) : (
              <Text
                style={[
                  styles.actionText,
                  styles.confirmText,
                  { color: destructive ? colors.danger : colors.primary },
                ]}
              >
                {confirmLabel}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={cancel}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={({ pressed }) => [
              styles.action,
              { borderTopColor: colors.border },
              pressed && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>
              {cancelLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  action: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: { fontSize: 15.5, fontWeight: '500' },
  confirmText: { fontWeight: '800' },
});
