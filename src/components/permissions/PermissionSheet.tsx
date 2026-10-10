import { Bell, Bluetooth, Camera, Image, MapPin, Mic } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SheetPhase } from '@/features/permissions/permissionFlow';
import {
  PERMISSION_COPY,
  type PermissionType,
} from '@/features/permissions/permissions';
import { spacing, useAppTheme } from '@/theme';

const ICONS = {
  camera: Camera,
  photos: Image,
  microphone: Mic,
  notifications: Bell,
  location: MapPin,
  bluetooth: Bluetooth,
};

export function PermissionIcon({
  type,
  size = 34,
}: {
  type: PermissionType;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const Icon = ICONS[type];
  return <Icon size={size} color={colors.primary} strokeWidth={2} />;
}

/** Title and text for each sheet / gate state. */
export function permissionText(type: PermissionType, phase: SheetPhase) {
  const copy = PERMISSION_COPY[type];
  if (phase === 'ask') return { title: copy.title, text: copy.reason };
  if (phase === 'denied') {
    return {
      title: copy.offTitle,
      text: `${copy.reason}. You can allow it now, or later when you need it.`,
    };
  }
  return {
    title: 'Permission needed',
    text: `${copy.name} is turned off for Nexity. Open Settings, turn it on, then come back.`,
  };
}

const PRIMARY_LABEL: Record<SheetPhase, string> = {
  ask: 'Allow',
  denied: 'Try again',
  blocked: 'Open Settings',
};

type Props = {
  visible: boolean;
  type: PermissionType;
  phase: SheetPhase;
  busy?: boolean;
  /** Allow / Try again (OS popup) or Open Settings, depending on `phase`. */
  onPrimary: () => void;
  /** Not now, backdrop tap and Android back. */
  onClose: () => void;
};

export function PermissionSheet({
  visible,
  type,
  phase,
  busy,
  onPrimary,
  onClose,
}: Props) {
  const { title, text } = permissionText(type, phase);
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <EmptyState
        icon={<PermissionIcon type={type} />}
        title={title}
        text={text}
        action={
          <View style={styles.actions}>
            <Button
              title={PRIMARY_LABEL[phase]}
              onPress={onPrimary}
              loading={busy}
              style={styles.button}
            />
            <Button
              title="Not now"
              variant="ghost"
              onPress={onClose}
              disabled={busy}
              style={styles.button}
            />
          </View>
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { alignSelf: 'stretch', gap: spacing.xs },
  button: { alignSelf: 'stretch' },
});
