import { type ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { PERMISSION_COPY, type PermissionType } from '@/features/permissions/permissions';
import { usePermission } from '@/features/permissions/usePermission';
import { spacing, useAppTheme } from '@/theme';

import { PermissionIcon, permissionText } from './PermissionSheet';

type Props = {
  type: PermissionType;
  /** Shown once access is on (also on Limited Photos). */
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Wraps an area that needs a permission (camera preview, gallery grid). Its
 * empty state is the explanation, so its button shows the OS popup directly;
 * after a refusal it offers Try again, then Open Settings. Turning access on
 * in Settings shows `children` as soon as the app is back in front.
 */
export function PermissionGate({ type, children, style }: Props) {
  const permission = usePermission(type);
  const [busy, setBusy] = useState(false);
  const { status, asked } = permission;

  if (status === undefined) return <View style={[styles.fill, style]} />;

  if (permission.granted) {
    return (
      <View style={[styles.fill, style]}>
        {permission.limited && type === 'photos' ? (
          <LimitedBar onManage={permission.manage} />
        ) : null}
        {children}
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View style={[styles.fill, styles.center, style]}>
        <EmptyState
          icon={<PermissionIcon type={type} />}
          title={`${PERMISSION_COPY[type].name} isn't available`}
          text="This device doesn't support it."
        />
      </View>
    );
  }

  const phase = status === 'blocked' ? 'blocked' : asked ? 'denied' : 'ask';
  const { title, text } = permissionText(type, phase);
  const label =
    phase === 'blocked' ? 'Open Settings' : phase === 'denied' ? 'Try again' : 'Allow';
  const onAction = async () => {
    if (phase === 'blocked') {
      permission.openSettings();
      return;
    }
    if (busy) return;
    setBusy(true);
    await permission.requestNow();
    setBusy(false);
  };

  return (
    <View style={[styles.fill, styles.center, style]}>
      <EmptyState
        icon={<PermissionIcon type={type} />}
        title={title}
        text={text}
        actionLabel={label}
        onAction={onAction}
      />
    </View>
  );
}

/** "Selected photos only" notice with a Manage link (iOS Limited Photos, Android 14). */
export function LimitedBar({ onManage }: { onManage: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.limited, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.limitedText, { color: colors.textSecondary }]}>
        You've allowed access to selected photos only.
      </Text>
      <Pressable
        onPress={onManage}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Manage selected photos"
      >
        <Text style={[styles.manage, { color: colors.primary }]}>Manage</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center' },
  limited: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  limitedText: { flex: 1, fontSize: 13 },
  manage: { fontSize: 13, fontWeight: '800' },
});
