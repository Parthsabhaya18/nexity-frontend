import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { useAppTheme } from '@/theme';

const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

const SCRIPT = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  default: 'cursive',
});

type Ink = { paper: string; wash: string; word: string; line: string };

function inkFor(dark: boolean): Ink {
  return dark
    ? { paper: '#3A1824', wash: '#4A2030', word: '#F3B4C8', line: '#E89AB4' }
    : { paper: '#F6D0DA', wash: '#E8B4C4', word: '#A33D5C', line: '#C45C78' };
}

function Heart({
  x,
  y,
  scale,
  rotate,
  ink,
}: {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  ink: Ink;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} opacity={0.72}>
      <Path d={HEART} fill="none" stroke={ink.line} strokeWidth={1.6} />
    </G>
  );
}

function Word({
  x,
  y,
  size,
  rotate,
  text,
  fill,
  weight,
}: {
  x: number;
  y: number;
  size: number;
  rotate: number;
  text: string;
  fill: string;
  weight?: '400' | '700';
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate})`} opacity={0.78}>
      <SvgText fontSize={size} fontFamily={weight ? undefined : SCRIPT} fontWeight={weight} fill={fill}>
        {text}
      </SvgText>
    </G>
  );
}

function Swirl({ x, y, rotate, ink }: { x: number; y: number; rotate: number; ink: Ink }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate})`} opacity={0.55}>
      <Path
        d="M2 18c8-2 10-10 6-14-6-6 4-10 10-4 4 4 2 12-4 16"
        fill="none"
        stroke={ink.line}
        strokeWidth={1.4}
      />
    </G>
  );
}

/** Still sheet of handwritten "love", outline hearts and swirls. Nothing moves. */
export function LoveWallpaper() {
  const { scheme } = useAppTheme();
  const ink = inkFor(scheme === 'dark');
  const id = `lovePaper${useId().replace(/:/g, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={220} height={280} patternUnits="userSpaceOnUse">
            <Rect width={220} height={280} fill={ink.paper} />
            <Rect x={0} y={40} width={90} height={70} fill={ink.wash} opacity={0.35} />
            <Rect x={120} y={150} width={100} height={80} fill={ink.wash} opacity={0.28} />
            <Word x={12} y={28} size={22} rotate={-12} text="love" fill={ink.word} />
            <Word x={118} y={34} size={16} rotate={8} text="LOVE" fill={ink.word} weight="700" />
            <Heart x={78} y={6} scale={0.42} rotate={-8} ink={ink} />
            <Swirl x={168} y={8} rotate={20} ink={ink} />
            <Word x={6} y={72} size={15} rotate={6} text="me" fill={ink.word} />
            <Word x={48} y={86} size={28} rotate={-6} text="Love" fill={ink.word} />
            <Heart x={150} y={58} scale={0.55} rotate={14} ink={ink} />
            <Word x={150} y={108} size={13} rotate={-18} text="love" fill={ink.word} />
            <Heart x={18} y={108} scale={0.32} rotate={10} ink={ink} />
            <Word x={70} y={128} size={18} rotate={12} text="LOVE" fill={ink.word} weight="700" />
            <Swirl x={8} y={140} rotate={-30} ink={ink} />
            <Heart x={168} y={132} scale={0.36} rotate={-12} ink={ink} />
            <Word x={16} y={176} size={26} rotate={-8} text="love" fill={ink.word} />
            <Word x={120} y={168} size={14} rotate={16} text="Love" fill={ink.word} />
            <Heart x={86} y={186} scale={0.48} rotate={6} ink={ink} />
            <Word x={150} y={206} size={20} rotate={-10} text="love" fill={ink.word} />
            <Swirl x={40} y={210} rotate={40} ink={ink} />
            <Word x={8} y={236} size={16} rotate={8} text="LOVE" fill={ink.word} weight="700" />
            <Heart x={100} y={228} scale={0.34} rotate={-16} ink={ink} />
            <Word x={140} y={252} size={18} rotate={-4} text="me" fill={ink.word} />
            <Heart x={20} y={248} scale={0.4} rotate={12} ink={ink} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
