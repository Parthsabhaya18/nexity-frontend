import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTabBarInset } from '@/navigation/BottomNav';
import {
  type AppTheme,
  getAppTheme,
  radius,
  spacing,
  useAppTheme,
} from '@/theme';
import { ThemeScope } from '@/theme/ThemeProvider';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  theme: AppTheme;
};

const DEFAULT_MS: Record<ToastType, number> = {
  success: 2600,
  info: 2600,
  error: 3800,
};

let current: ToastItem | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getCurrent = () => current;

/** A newer toast replaces the one on screen. */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options?: { duration?: number; theme?: AppTheme },
) {
  current = {
    id: nextId++,
    type,
    message,
    duration: options?.duration ?? DEFAULT_MS[type],
    theme: options?.theme ?? getAppTheme(),
  };
  emit();
}

function dismissToast(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

/** Toasts take the theme of the screen that shows them. */
export function useToast() {
  const theme = useAppTheme();
  return useMemo(() => {
    const show = (message: string, type: ToastType = 'info') =>
      showToast(message, type, { theme });
    return {
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
    };
  }, [theme]);
}

/** The toast pill itself, without positioning or timing. */
export function ToastCard({
  type,
  message,
}: {
  type: ToastType;
  message: string;
}) {
  const { colors } = useAppTheme();
  const iconColor =
    type === 'success'
      ? colors.success
      : type === 'error'
      ? colors.danger
      : colors.primary;
  const Icon =
    type === 'success' ? CircleCheck : type === 'error' ? CircleAlert : Info;

  return (
    <View style={[styles.card, { backgroundColor: colors.text }]}>
      <Icon size={20} color={iconColor} strokeWidth={2.4} />
      <Text
        style={[styles.text, { color: colors.background }]}
        numberOfLines={3}
      >
        {message}
      </Text>
    </View>
  );
}

/** Render once at the app root. Sits above the floating bottom nav. */
export function ToastHost() {
  const item = useSyncExternalStore(subscribe, getCurrent);
  const [shown, setShown] = useState<ToastItem | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const bottom = useTabBarInset() + spacing.sm;

  useEffect(() => {
    if (!item) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShown(null);
      });
      return;
    }
    setShown(item);
    AccessibilityInfo.announceForAccessibility(item.message);
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => dismissToast(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item, progress]);

  if (!shown) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
        <ThemeScope theme={shown.theme}>
          <Pressable
            onPress={() => dismissToast(shown.id)}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityHint="Tap to dismiss"
          >
            <ToastCard type={shown.type} message={shown.message} />
          </Pressable>
        </ThemeScope>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 440,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    elevation: 6,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flexShrink: 1, fontSize: 14, fontWeight: '700', lineHeight: 19 },
});
