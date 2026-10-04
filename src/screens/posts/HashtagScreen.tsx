import { useCallback } from 'react';
import { Hash } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostGrid } from '@/components/posts/PostGrid';
import { AppBar } from '@/components/ui/AppBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { postsApi } from '@/services/api/posts';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { useAppTheme } from '@/theme';

export function HashtagScreen({ route }: ScreenProps<'HashtagFeed'>) {
  const { colors } = useAppTheme();
  const { tag } = route.params;
  useStatusBar();
  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.byTag(tag, cursor, signal),
    [tag],
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title={`#${tag}`} back />
      <PostGrid
        fetchPage={fetchPage}
        empty={
          <EmptyState
            icon={<Hash size={34} color={colors.primary} />}
            title="No posts yet"
            text={`Be the first to use #${tag}.`}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
