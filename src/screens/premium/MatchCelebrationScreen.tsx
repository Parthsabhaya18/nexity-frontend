import { StackActions } from '@react-navigation/native';
import { MapPin, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fireworks, FloatingHearts } from '@/components/celebration/Celebration';
import { Avatar } from '@/components/ui/Avatar';
import { GradientFill } from '@/components/ui/GradientFill';
import { IconButton } from '@/components/ui/IconButton';
import { useReduceMotion } from '@/components/ui/SkeletonLoader';
import { markCelebrationSeen } from '@/features/crush/celebration';
import { refreshCrush, useCrushMatch } from '@/features/crush/crushQueries';
import { nearText } from '@/features/secret/format';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { secretCrushApi } from '@/services/api/secretCrush';
import { ApiError } from '@/services/api/client';
import { loveTheme, radius, spacing, useAppTheme } from '@/theme';
import { ThemeScope } from '@/theme/ThemeProvider';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function MatchCelebrationScreen(props: ScreenProps<'MatchCelebration'>) {
  const app = useAppTheme();
  const theme = useMemo(() => loveTheme(app), [app]);
  return (
    <ThemeScope theme={theme}>
      <Celebration {...props} />
    </ThemeScope>
  );
}

function Celebration({ navigation, route }: ScreenProps<'MatchCelebration'>) {
  const { matchId } = route.params;
  const { colors, gradient } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  useStatusBar('dark');
  const matchQ = useCrushMatch(matchId);
  const match = matchQ.data;
  const enter = useRef(new Animated.Value(0)).current;
  const marked = useRef(false);

  useEffect(() => {
    markCelebrationSeen(matchId);
  }, [matchId]);

  useEffect(() => {
    if (!match) return;
    if (!marked.current) {
      marked.current = true;
      secretCrushApi
        .celebrated(matchId)
        .then(() => refreshCrush())
        .catch(() => {});
    }
    AccessibilityInfo.announceForAccessibility(`It's a match with ${match.user.display_name}`);
    if (reduce) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [match, matchId, reduce, enter]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const opened = useRef(false);
  const toChat = (draft?: string) => {
    const conversationId = match?.conversation_id;
    if (!conversationId || opened.current) return;
    opened.current = true;
    navigation.dispatch(
      StackActions.replace('ChatThread', draft ? { conversationId, draft } : { conversationId }),
    );
  };

  // Both phones receive the match. After the celebration, the same chat opens on each.
  useEffect(() => {
    if (!match?.conversation_id) return;
    const timer = setTimeout(() => toChat(), 1400);
    return () => clearTimeout(timer);
  }, [match?.conversation_id]);

  const particleColors = useMemo(
    () => [colors.onButton, colors.primary, colors.accent, colors.like, colors.primarySoft],
    [colors],
  );

  const leftX = enter.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const rightX = enter.interpolate({ inputRange: [0, 1], outputRange: [140, 0] });
  const heartScale = enter.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.4, 1] });

  const notFound = matchQ.error instanceof ApiError && matchQ.error.status === 404;
  const near = nearText(match?.nearby_hint);

  return (
    <View style={styles.root}>
      <GradientFill colors={gradient} />
      <FloatingHearts count={14} opacity={0.8} />
      {match ? <Fireworks colors={particleColors} /> : null}

      <View style={[styles.close, { top: insets.top + 6 }]}>
        <IconButton onPress={() => navigation.goBack()} accessibilityLabel="Close">
          <X size={24} color={colors.onButton} />
        </IconButton>
      </View>

      <View
        style={[
          styles.stage,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {match ? (
          <>
            <View style={styles.avatars} accessibilityElementsHidden>
              <Animated.View
                style={[
                  styles.ring,
                  { borderColor: colors.onButton, transform: [{ translateX: leftX }] },
                ]}
              >
                <Avatar uri={match.me.avatar_url} name={match.me.display_name} size={104} />
              </Animated.View>
              <Animated.Text style={[styles.midHeart, { transform: [{ scale: heartScale }] }]}>
                💘
              </Animated.Text>
              <Animated.View
                style={[
                  styles.ring,
                  { borderColor: colors.onButton, transform: [{ translateX: rightX }] },
                ]}
              >
                <Avatar uri={match.user.avatar_url} name={match.user.display_name} size={104} />
              </Animated.View>
            </View>
            <Text style={[styles.eyebrow, { color: colors.onButton }]}>Congratulations!</Text>
            <Text style={[styles.title, { color: colors.onButton }]} accessibilityRole="header">
              It's a match 💘
            </Text>
            <Text style={[styles.text, { color: colors.onButton }]}>
              You and <Text style={styles.bold}>{match.user.display_name}</Text> both added each
              other as a Secret Crush. Your chat is open.
            </Text>
            {near ? (
              <View style={[styles.near, { backgroundColor: colors.primarySoft }]}>
                <MapPin size={13} color={colors.onButton} />
                <Text style={[styles.nearText, { color: colors.onButton }]}>{near}</Text>
              </View>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => toChat('Hi 👋')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.onButton, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.button }]}>
                  Say hi to {firstName(match.user.display_name)} 👋
                </Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.dispatch(StackActions.replace('Chats'))}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ghost,
                  { borderColor: colors.onButton, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.onButton }]}>Open chats</Text>
              </Pressable>
            </View>
          </>
        ) : notFound || matchQ.isError ? (
          <>
            <Text style={[styles.title, { color: colors.onButton }]}>
              {notFound ? 'This match is no longer available' : "Couldn't load the match"}
            </Text>
            <Pressable
              onPress={() => (notFound ? navigation.goBack() : matchQ.refetch())}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primary,
                styles.single,
                { backgroundColor: colors.onButton, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.button }]}>
                {notFound ? 'Close' : 'Try again'}
              </Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.onButton} size="large" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  close: { position: 'absolute', left: 8, zIndex: 2 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  avatars: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  ring: { borderWidth: 3, borderRadius: 60, padding: 3 },
  midHeart: { fontSize: 40, marginHorizontal: -10, zIndex: 1 },
  eyebrow: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5, opacity: 0.9 },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center' },
  text: { fontSize: 15.5, lineHeight: 22, textAlign: 'center', opacity: 0.95 },
  bold: { fontWeight: '800' },
  near: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: 4,
  },
  nearText: { fontSize: 13, fontWeight: '700' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: spacing.lg },
  primary: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  single: { alignSelf: 'stretch', marginTop: spacing.md },
  ghost: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  primaryText: { fontSize: 16, fontWeight: '800' },
});
