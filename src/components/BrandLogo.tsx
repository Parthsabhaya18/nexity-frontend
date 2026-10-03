import { Image, type ImageStyle, type StyleProp, StyleSheet } from 'react-native';

type Variant = 'horizontal' | 'icon' | 'dark';

type Props = {
  variant?: Variant;
  width?: number;
  style?: StyleProp<ImageStyle>;
};

const sources = {
  horizontal: require('@/assets/brand/png/primary-logo.png'),
  icon: require('@/assets/brand/png/icon-only-512.png'),
  dark: require('@/assets/brand/png/dark-mode-logo.png'),
} as const;

/** Horizontal lockup is 169.56 × 64. */
const HORIZONTAL_RATIO = 169.56 / 64;

export function BrandLogo({ variant = 'horizontal', width = 188, style }: Props) {
  const height = variant === 'icon' ? width : width / HORIZONTAL_RATIO;

  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Nexity"
      source={sources[variant]}
      resizeMode="contain"
      style={[styles.base, { width, height }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
