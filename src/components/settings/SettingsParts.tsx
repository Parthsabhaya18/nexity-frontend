import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Toggle } from '@/components/ui/Toggle';
import { radius, spacing, useAppTheme } from '@/theme';

/** Titled card; children are separated by hairlines. */
export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? (
        <Text
          style={[styles.groupTitle, { color: colors.textSecondary }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

function RowIcon({ icon: Icon, danger }: { icon: LucideIcon; danger?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.icon,
        { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft },
      ]}
    >
      <Icon size={19} color={danger ? colors.danger : colors.primary} />
    </View>
  );
}

function RowText({
  label,
  sub,
  danger,
}: {
  label: string;
  sub?: string;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.text}>
      <Text
        style={[styles.label, { color: danger ? colors.danger : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  sub,
  value,
  onPress,
  danger,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={sub}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <RowIcon icon={icon} danger={danger} />
      <RowText label={label} sub={sub} danger={danger} />
      {value ? (
        <Text
          style={[styles.value, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={danger ? colors.danger : colors.primary} />
      ) : danger ? null : (
        <ChevronRight size={18} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

export function SettingsToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
  disabled,
}: {
  icon?: LucideIcon;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.toggleBody, disabled && styles.disabled]}>
        {icon ? <RowIcon icon={icon} /> : null}
        <RowText label={label} sub={sub} />
      </View>
      <Toggle
        value={value}
        onChange={onChange}
        accessibilityLabel={label}
        disabled={disabled}
      />
    </View>
  );
}

/** Label / value line for read-only details. */
export function InfoRow({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.info}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.infoValueWrap}>
        <Text
          style={[styles.infoValue, { color: colors.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {trailing}
      </View>
    </View>
  );
}

/** Tinted note card, e.g. "We'll email you about new logins". */
export function NoteCard({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.note, { backgroundColor: colors.primarySofter }]}>
      <Icon size={18} color={colors.primary} />
      <Text style={[styles.noteText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  fine: { fontSize: 12.5, lineHeight: 18, marginHorizontal: 4 },
});

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 60,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  value: { fontSize: 13.5, fontWeight: '600', maxWidth: 120 },
  disabled: { opacity: 0.5 },
  toggleBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  infoLabel: { fontSize: 14 },
  infoValueWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  noteText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});
