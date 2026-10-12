import { StyleSheet, View, type ViewProps } from 'react-native';
import {
  type Edge,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

type Props = ViewProps & { edges?: readonly Edge[] };

/**
 * Drop-in for the library `SafeAreaView` on full screens. The native one can report a
 * zero inset for a frame while a screen slides in on Android, so the header jumps under
 * the status bar and back; insets from the provider are known before the first frame.
 * Like the native view, the inset is added to any padding already in `style`.
 */
export function SafeAreaView({ edges = ALL_EDGES, style, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const flat = StyleSheet.flatten(style) ?? {};
  const base = (edge: 'Top' | 'Right' | 'Bottom' | 'Left') => {
    const axis = edge === 'Top' || edge === 'Bottom' ? 'paddingVertical' : 'paddingHorizontal';
    const value = flat[`padding${edge}`] ?? flat[axis] ?? flat.padding ?? 0;
    return typeof value === 'number' ? value : 0;
  };
  const padding = {
    ...(edges.includes('top') && { paddingTop: base('Top') + insets.top }),
    ...(edges.includes('right') && { paddingRight: base('Right') + insets.right }),
    ...(edges.includes('bottom') && { paddingBottom: base('Bottom') + insets.bottom }),
    ...(edges.includes('left') && { paddingLeft: base('Left') + insets.left }),
  };
  return <View style={[style, padding]} {...rest} />;
}
