import {
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  useColorScheme,
} from 'react-native';

type Variant = 'horizontal' | 'stacked' | 'icon';

type Props = {
  variant?: Variant;
  width?: number;
  /** Force the light or dark artwork; defaults to the system colour scheme. */
  scheme?: 'light' | 'dark';
  style?: StyleProp<ImageStyle>;
};

const sources = {
  horizontal: {
    light: require('@/assets/brand/identity/png/nexity-logo-horizontal.png'),
    dark: require('@/assets/brand/identity/png/nexity-logo-horizontal-dark.png'),
  },
  stacked: {
    light: require('@/assets/brand/png/logo-stacked.png'),
    dark: require('@/assets/brand/png/logo-stacked-dark.png'),
  },
  icon: {
    light: require('@/assets/brand/identity/png/nexity-symbol.png'),
    dark: require('@/assets/brand/identity/png/nexity-symbol.png'),
  },
} as const;

/** Width ÷ height of each SVG master's viewBox. */
const ratios: Record<Variant, number> = {
  horizontal: 376.19 / 98,
  stacked: 200 / 174,
  icon: 340 / 253,
};

export function BrandLogo({
  variant = 'horizontal',
  width = 188,
  scheme,
  style,
}: Props) {
  const system = useColorScheme();
  const tone = scheme ?? (system === 'dark' ? 'dark' : 'light');

  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Nexity"
      source={sources[variant][tone]}
      resizeMode="contain"
      style={[styles.base, { width, height: width / ratios[variant] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
