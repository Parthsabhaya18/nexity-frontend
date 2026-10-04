import { User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { GradientFill } from './GradientFill';

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
  /** Green presence dot, bordered with the surface behind the avatar. */
  online?: boolean;
  onlineBorder?: string;
  style?: ViewStyle;
};

export function Avatar({
  uri,
  name,
  size = 40,
  ring,
  ringGap,
  online,
  onlineBorder,
  style,
}: Props) {
  const { colors, gradient } = useAppTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  const inner = ring ? size - RING_WIDTH * 2 : size;
  const imageUri = uri && !failed ? uri : null;
  const icon = Math.round(inner * 0.48);
  const dot = Math.min(14, Math.max(10, Math.round(size * 0.28)));

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        ring && styles.center,
        ring === 'seen' && { backgroundColor: colors.border },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={
        imageUri ? `${name}'s profile photo` : `${name}, no profile photo`
      }
    >
      {ring === 'unseen' ? (
        <GradientFill colors={gradient} radius={size / 2} />
      ) : null}
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: colors.surfaceAlt,
          },
          ring && {
            borderWidth: RING_GAP,
            borderColor: ringGap ?? colors.background,
          },
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <User size={icon} color={colors.textSecondary} strokeWidth={1.75} />
        )}
      </View>
      {online ? (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.online,
              borderColor: onlineBorder ?? colors.background,
            },
          ]}
          accessibilityLabel="Active now"
        />
      ) : null}
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
  dot: { position: 'absolute', right: 1, bottom: 1, borderWidth: 2.5 },
});
