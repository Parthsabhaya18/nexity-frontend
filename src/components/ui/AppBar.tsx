import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { IconButton } from './IconButton';

type Props = {
  title?: string;
  subtitle?: string;
  /** Replaces the title text, e.g. with the logo. */
  left?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
  /** Text colour override for dark screens. */
  tint?: string;
};

export const APPBAR_HEIGHT = 58;

export function AppBar({ title, subtitle, left, actions, back, tint }: Props) {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const color = tint ?? colors.text;

  return (
    <View style={styles.bar}>
      {back ? (
        <IconButton
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={color} />
        </IconButton>
      ) : null}
      <View style={styles.title}>
        {left ?? (
          <>
            <Text
              style={[styles.titleText, { color }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  { color: tint ?? colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: APPBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  title: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  titleText: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
