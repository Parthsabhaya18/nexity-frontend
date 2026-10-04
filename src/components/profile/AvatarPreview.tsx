import { User, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { darkScreen } from '@/theme';

type Props = {
  visible: boolean;
  uri?: string | null;
  name: string;
  username?: string;
  onClose: () => void;
};

type Zoom = { scale: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampZoom(zoom: Zoom, size: number): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoom.scale));
  const max = ((scale - 1) * size) / 2;
  return {
    scale,
    x: Math.min(max, Math.max(-max, zoom.x)),
    y: Math.min(max, Math.max(-max, zoom.y)),
  };
}

/** Large profile photo. Pinch to zoom and drag; tap the background to close. */
export function AvatarPreview({
  visible,
  uri,
  name,
  username,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(width - 48, 360);
  const [zoom, setZoom] = useState<Zoom>({ scale: 1, x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const start = useRef({ ...zoom, distance: 0 });

  const reset = () => setZoom({ scale: 1, x: 0, y: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const touches = evt.nativeEvent.touches;
        start.current = {
          ...zoomRef.current,
          distance:
            touches.length >= 2
              ? Math.hypot(
                  touches[0]!.pageX - touches[1]!.pageX,
                  touches[0]!.pageY - touches[1]!.pageY,
                )
              : 0,
        };
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const distance = Math.hypot(
            touches[0]!.pageX - touches[1]!.pageX,
            touches[0]!.pageY - touches[1]!.pageY,
          );
          const origin = start.current.distance || distance;
          setZoom(
            clampZoom(
              {
                ...start.current,
                scale: start.current.scale * (distance / origin),
              },
              size,
            ),
          );
          return;
        }
        setZoom(
          clampZoom(
            {
              ...start.current,
              x: start.current.x + gesture.dx,
              y: start.current.y + gesture.dy,
            },
            size,
          ),
        );
      },
      onPanResponderRelease: () => {
        if (zoomRef.current.scale <= 1.02) reset();
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={reset}
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close profile photo"
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={styles.close}
        >
          <X size={28} color={darkScreen.text} />
        </Pressable>
        <View style={styles.center} pointerEvents="box-none">
          {uri ? (
            <View
              {...pan.panHandlers}
              style={[
                styles.frame,
                { width: size, height: size, borderRadius: size / 2 },
              ]}
            >
              <Image
                source={{ uri }}
                accessibilityLabel={`${name}'s profile photo`}
                style={[
                  styles.photo,
                  {
                    transform: [
                      { translateX: zoom.x },
                      { translateY: zoom.y },
                      { scale: zoom.scale },
                    ],
                  },
                ]}
              />
            </View>
          ) : (
            <View
              style={[
                styles.frame,
                styles.empty,
                { width: size, height: size, borderRadius: size / 2 },
              ]}
            >
              <User size={size * 0.42} color="rgba(255,255,255,0.85)" />
            </View>
          )}
          {username ? <Text style={styles.username}>@{username}</Text> : null}
          {uri ? <Text style={styles.hint}>Pinch to zoom</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.94)' },
  close: { alignSelf: 'flex-end', padding: 16, zIndex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { overflow: 'hidden', backgroundColor: '#1C1C1E' },
  photo: { width: '100%', height: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  username: { color: darkScreen.text, fontSize: 16, fontWeight: '700' },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
});
