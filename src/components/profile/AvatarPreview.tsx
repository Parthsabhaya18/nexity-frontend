import { User, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/media/ZoomableImage';
import { darkScreen } from '@/theme';

type Props = {
  visible: boolean;
  uri?: string | null;
  name: string;
  onClose: () => void;
};

/** Full-screen profile photo: pinch to zoom, drag, double-tap to zoom in or out. */
export function AvatarPreview({ visible, uri, name, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {uri ? (
          <ZoomableImage
            uri={uri}
            width={width}
            height={height}
            accessibilityLabel={`${name}'s profile photo`}
          />
        ) : (
          <View style={styles.empty}>
            <User size={width * 0.3} color="rgba(255,255,255,0.85)" />
          </View>
        )}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <X size={26} color={darkScreen.text} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
