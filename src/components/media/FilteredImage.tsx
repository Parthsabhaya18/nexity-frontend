import {
  Blur,
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  type SkImage,
} from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  type ColorMatrix as Matrix,
  isIdentity,
} from '@/features/media/filterEngine';

type Props = {
  image: SkImage;
  width: number;
  height: number;
  matrix?: Matrix;
  fit?: 'cover' | 'contain' | 'fill';
  /** Gaussian blur radius in points (for the blurred backdrop). */
  blur?: number;
  style?: StyleProp<ViewStyle>;
};

/** A decoded photo drawn by Skia with a live colour matrix (filters + adjustments). */
export function FilteredImage({
  image,
  width,
  height,
  matrix,
  fit = 'cover',
  blur,
  style,
}: Props) {
  return (
    <Canvas style={[{ width, height }, style]} pointerEvents="none">
      <SkiaImage
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
        fit={fit}
      >
        {matrix && !isIdentity(matrix) ? <ColorMatrix matrix={matrix} /> : null}
        {blur ? <Blur blur={blur} mode="clamp" /> : null}
      </SkiaImage>
    </Canvas>
  );
}
