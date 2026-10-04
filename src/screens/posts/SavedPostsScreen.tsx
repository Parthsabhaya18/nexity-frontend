import { Bookmark } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostGrid } from '@/components/posts/PostGrid';
import { AppBar } from '@/components/ui/AppBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { postsApi } from '@/services/api/posts';
import { useStatusBar } from '@/navigation/useStatusBar';
import { useAppTheme } from '@/theme';

export function SavedPostsScreen() {
  const { colors } = useAppTheme();
  useStatusBar();
  const fetchPage = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      postsApi.saved(cursor, signal),
    [],
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Saved" back />
      <PostGrid
        fetchPage={fetchPage}
        empty={
          <EmptyState
            icon={<Bookmark size={34} color={colors.primary} />}
            title="No saved posts"
            text="Save photos and videos that you want to see again."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
