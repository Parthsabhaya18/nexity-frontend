import { useScrollToTop } from '@react-navigation/native';
import { Bell, Camera, MessageCircle } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useChats } from '@/features/chats/useChats';
import { useNotifications } from '@/features/notifications/useNotifications';
import { useTabBarInset } from '@/navigation/BottomNav';
import type { TabScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { useAppTheme } from '@/theme';

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { user } = useAuth();
  const { scheme, colors } = useAppTheme();
  const bottomInset = useTabBarInset();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { unreadCount: unreadChats } = useChats();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  useStatusBar();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
        left={<BrandLogo variant="horizontal" width={112} scheme={scheme} />}
        actions={
          <>
            <IconButton
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
              badge={unreadNotifications}
            >
              <Bell size={24} color={colors.text} />
            </IconButton>
            <IconButton
              onPress={() => navigation.navigate('Chats')}
              accessibilityLabel="Chats"
              badge={unreadChats}
            >
              <MessageCircle size={24} color={colors.text} />
            </IconButton>
            <IconButton
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Your profile"
              size={40}
              style={styles.me}
            >
              <Avatar
                uri={user?.avatar_url}
                name={user?.display_name ?? ''}
                size={34}
              />
            </IconButton>
          </>
        }
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <EmptyState
          icon={<Camera size={34} color={colors.primary} />}
          title="Your feed is empty"
          text="Posts from people you follow will show up here. Share your first moment to get started."
          action={
            <Button
              title="Create a post"
              onPress={() => navigation.navigate('Create')}
              style={styles.cta}
            />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  cta: { minWidth: 200 },
  me: { marginLeft: 2 },
});
