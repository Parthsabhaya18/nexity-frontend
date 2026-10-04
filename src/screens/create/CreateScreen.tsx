import {
  ChevronRight,
  CircleFadingPlus,
  Clapperboard,
  Image as ImageIcon,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientFill } from '@/components/ui/GradientFill';
import type { ScreenProps } from '@/navigation/types';
import { radius, spacing, useAppTheme } from '@/theme';

const REEL_GRADIENT = ['#FF5C8A', '#A855F7'] as const;
const STORY_GRADIENT = ['#F59E0B', '#E5487E'] as const;

/** Bottom sheet opened from the + button. Each option is wired up in its own step. */
export function CreateScreen({ navigation }: ScreenProps<'Create'>) {
  const { colors, gradient } = useAppTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 0],
  });

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateY }],
          },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text
          style={[styles.title, { color: colors.text }]}
          accessibilityRole="header"
        >
          Create
        </Text>
        <View style={styles.options}>
          <Option
            title="Post"
            text="Share photos with your followers"
            colors={gradient}
            icon={<ImageIcon size={24} color="#FFFFFF" />}
            onPress={() => navigation.replace('CreatePostCrop')}
          />
          <Option
            title="Story"
            text="Share a moment that disappears in 24 hours"
            colors={STORY_GRADIENT}
            icon={<CircleFadingPlus size={24} color="#FFFFFF" />}
            onPress={() => navigation.replace('CreateStory')}
          />
          <Option
            title="Reel"
            text="Share a short vertical video"
            colors={REEL_GRADIENT}
            icon={<Clapperboard size={24} color="#FFFFFF" />}
            onPress={() => navigation.replace('CreateReel')}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function Option({
  title,
  text,
  colors: gradientColors,
  icon,
  onPress,
}: {
  title: string;
  text: string;
  colors: readonly string[];
  icon: ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const disabled = !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={disabled ? 'Coming soon' : text}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: colors.background },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionIcon}>
        <GradientFill colors={gradientColors} radius={14} />
        {icon}
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
          {text}
        </Text>
      </View>
      {disabled ? (
        <View style={[styles.soon, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.soonText, { color: colors.primary }]}>Soon</Text>
        </View>
      ) : (
        <ChevronRight size={18} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, minWidth: 0, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSub: { fontSize: 13 },
  soon: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  soonText: { fontSize: 11, fontWeight: '800' },
});
