import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  colors: readonly string[];
  /** Corner radius of the parent, so the fill does not bleed past rounded edges. */
  radius?: number;
};

/** Absolutely positioned 135° linear gradient that fills its parent. */
export function GradientFill({ colors, radius = 0 }: Props) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const last = Math.max(colors.length - 1, 1);

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {colors.map((color, i) => (
            <Stop key={`${color}-${i}`} offset={i / last} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        rx={radius}
        ry={radius}
        fill={`url(#${id})`}
      />
    </Svg>
  );
}
