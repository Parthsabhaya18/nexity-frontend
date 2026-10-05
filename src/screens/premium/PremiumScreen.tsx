import { useScrollToTop } from '@react-navigation/native';
import { Crown } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeAreaView';

import { AppBar } from '@/components/ui/AppBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTabBarInset } from '@/navigation/BottomNav';
import { useStatusBar } from '@/navigation/useStatusBar';
import { useAppTheme } from '@/theme';

export function PremiumScreen() {
  const { colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  useStatusBar();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar title="Premium" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <EmptyState
          icon={<Crown size={34} color={colors.primary} />}
          title="Nexity Premium"
          text="Exclusive features for premium members are coming soon."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
});
