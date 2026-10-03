import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { GradientFill } from './GradientFill';

const PLACEHOLDER = ['#B9A3FF', '#F2A7C6'] as const;
const RING_WIDTH = 3;
const RING_GAP = 2.5;

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
  /** Story ring: `unseen` uses the brand gradient, `seen` a muted outline. */
  ring?: 'unseen' | 'seen';
  /** Colour between the ring and the photo; match the surface behind the avatar. */
  ringGap?: string;
  style?: ViewStyle;
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function Avatar({ uri, name, size = 40, ring, ringGap, style }: Props) {
  const { colors, gradient } = useAppTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  const inner = ring ? size - RING_WIDTH * 2 : size;
  const imageUri = uri && !failed ? uri : null;

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        ring && styles.center,
        ring === 'seen' && { backgroundColor: colors.border },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`${name}'s profile photo`}
    >
      {ring === 'unseen' ? (
        <GradientFill colors={gradient} radius={size / 2} />
      ) : null}
      <View
        style={[
          styles.inner,
          { width: inner, height: inner, borderRadius: inner / 2 },
          ring && {
            borderWidth: RING_GAP,
            borderColor: ringGap ?? colors.background,
          },
        ]}
      >
        <GradientFill colors={PLACEHOLDER} />
        <Text
          style={[styles.initials, { fontSize: Math.round(inner * 0.36) }]}
          allowFontScaling={false}
        >
          {initials(name)}
        </Text>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.3 },
});
