import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Clapperboard, Crown, Home, Plus, Search } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientFill } from '@/components/ui/GradientFill';
import { darkScreen, radius, useAppTheme } from '@/theme';

import type { MainTabParamList } from './types';

const PILL_HEIGHT = 64;
const BOTTOM_GAP = 12;
const TOP_GAP = 12;
const FAB_SIZE = 48;
const FAB_GAP = 10;
const SIDE_GAP = 16;

/** Bottom padding a tab screen needs so its content clears the floating nav. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return PILL_HEIGHT + BOTTOM_GAP + TOP_GAP + insets.bottom;
}

/** Tabs whose screen is full-bleed black, so the nav switches to its dark look. */
const DARK_TABS: ReadonlySet<keyof MainTabParamList> = new Set();

const LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Search: 'Search',
  Premium: 'Premium',
  Reels: 'Reels',
};

/** Tabs drawn in the brand colour even when inactive. */
const HIGHLIGHT_TABS: ReadonlySet<keyof MainTabParamList> = new Set([
  'Premium',
]);

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, gradient } = useAppTheme();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null;

  const activeName = state.routes[state.index].name as keyof MainTabParamList;
  const dark = DARK_TABS.has(activeName);
  const activeColor = dark ? darkScreen.text : colors.text;
  const inactiveColor = dark ? darkScreen.navInactive : colors.textSecondary;

  const icon = (
    name: keyof MainTabParamList,
    color: string,
    focused: boolean,
  ) => {
    const strokeWidth = focused ? 2.3 : 2;
    const icons: Record<keyof MainTabParamList, ReactNode> = {
      Home: <Home size={24} color={color} strokeWidth={strokeWidth} />,
      Search: <Search size={24} color={color} strokeWidth={strokeWidth} />,
      Premium: (
        <Crown
          size={24}
          color={color}
          fill={focused ? color : 'transparent'}
          strokeWidth={strokeWidth}
        />
      ),
      Reels: <Clapperboard size={24} color={color} strokeWidth={strokeWidth} />,
    };
    return icons[name];
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + BOTTOM_GAP }]}
    >
      <View style={styles.group}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: dark ? darkScreen.navBackground : colors.surface,
              borderColor: dark ? darkScreen.navBorder : colors.border,
            },
            dark && styles.flat,
          ]}
        >
          {state.routes.map((route, index) => {
            const name = route.name as keyof MainTabParamList;
            const focused = state.index === index;
            const color = HIGHLIGHT_TABS.has(name)
              ? colors.primary
              : focused
              ? activeColor
              : inactiveColor;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityLabel={LABELS[name]}
                accessibilityState={{ selected: focused }}
                style={styles.item}
              >
                {({ pressed }) => (
                  <>
                    <View style={[styles.icon, pressed && styles.iconPressed]}>
                      {icon(name, color, focused)}
                    </View>
                    <Text style={[styles.label, { color }]} numberOfLines={1}>
                      {LABELS[name]}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Create')}
          accessibilityRole="button"
          accessibilityLabel="Create a post, story or reel"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.button },
            dark && styles.flat,
            pressed && styles.fabPressed,
          ]}
        >
          <GradientFill colors={gradient} radius={FAB_SIZE / 2} />
          <Plus size={24} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: SIDE_GAP,
  },
  group: {
    flex: 1,
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAB_GAP,
  },
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.full,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  flat: { elevation: 0, shadowOpacity: 0 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: {
    width: 44,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: { transform: [{ scale: 0.9 }] },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.92 }] },
});
