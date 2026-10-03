import { Clapperboard } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { darkScreen } from '@/theme';

export function ReelsScreen({ navigation }: TabScreenProps<'Reels'>) {
  const bottomInset = useTabBarInset();
  useStatusBar('dark');

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: darkScreen.background }]}
    >
      <AppBar title="Reels" tint={darkScreen.text} />
      <View style={[styles.content, { paddingBottom: bottomInset }]}>
        <EmptyState
          tone="dark"
          icon={<Clapperboard size={34} color={darkScreen.text} />}
          title="No reels yet"
          text="Short vertical videos from people you follow will play here."
          action={
            <Button
              title="Create a reel"
              onPress={() => navigation.navigate('Create')}
              style={styles.cta}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  cta: { minWidth: 200 },
});
