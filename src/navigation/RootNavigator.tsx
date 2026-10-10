import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '@/features/auth/AuthProvider';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from '@/screens/auth/VerifyEmailScreen';
import { ChatsScreen } from '@/screens/chats/ChatsScreen';
import { ChatThreadScreen } from '@/screens/chats/ChatThreadScreen';
import { NewMessageScreen } from '@/screens/chats/NewMessageScreen';
import { ComponentGalleryScreen } from '@/screens/dev/ComponentGalleryScreen';
import { CreatePostCropScreen } from '@/screens/create/CreatePostCropScreen';
import { CreatePostDetailsScreen } from '@/screens/create/CreatePostDetailsScreen';
import { CreateReelScreen } from '@/screens/create/CreateReelScreen';
import { CreateScreen } from '@/screens/create/CreateScreen';
import { CreateStoryScreen } from '@/screens/create/CreateStoryScreen';
import { ShareStoryScreen } from '@/screens/create/ShareStoryScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { FollowersScreen } from '@/screens/profile/FollowersScreen';
import { FollowRequestsScreen } from '@/screens/profile/FollowRequestsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { UserProfileScreen } from '@/screens/profile/UserProfileScreen';
import { PostDetailScreen } from '@/screens/posts/PostDetailScreen';
import { PostViewerScreen } from '@/screens/posts/PostViewerScreen';
import { SavedPostsScreen } from '@/screens/posts/SavedPostsScreen';
import { AccountInfoScreen } from '@/screens/settings/AccountInfoScreen';
import { BlockedAccountsScreen } from '@/screens/settings/BlockedAccountsScreen';
import { ChangePasswordScreen } from '@/screens/settings/ChangePasswordScreen';
import {
  ContactSentScreen,
  ContactUsScreen,
} from '@/screens/settings/ContactUsScreen';
import { HelpCenterScreen } from '@/screens/settings/HelpCenterScreen';
import { LegalScreen } from '@/screens/settings/LegalScreen';
import { LoginSecurityScreen } from '@/screens/settings/LoginSecurityScreen';
import { SupportTicketScreen } from '@/screens/settings/SupportTicketScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';
import { PrivacySettingsScreen } from '@/screens/settings/PrivacySettingsScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { useAppTheme } from '@/theme';

import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useAuth();
  const { scheme, colors } = useAppTheme();

  const navTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (status === 'loading') {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <BrandLogo variant="stacked" width={160} style={styles.logo} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="Followers" component={FollowersScreen} />
            <Stack.Screen
              name="FollowRequests"
              component={FollowRequestsScreen}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="BlockedAccounts"
              component={BlockedAccountsScreen}
            />
            <Stack.Screen name="AccountInfo" component={AccountInfoScreen} />
            <Stack.Screen
              name="PrivacySettings"
              component={PrivacySettingsScreen}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
            />
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
            />
            <Stack.Screen
              name="LoginSecurity"
              component={LoginSecurityScreen}
            />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="ContactUs" component={ContactUsScreen} />
            <Stack.Screen
              name="ContactSent"
              component={ContactSentScreen}
              options={{ animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen
              name="SupportTicket"
              component={SupportTicketScreen}
            />
            <Stack.Screen name="Legal" component={LegalScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="PostViewer" component={PostViewerScreen} />
            <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
            />
            {__DEV__ ? (
              <Stack.Screen
                name="DevComponents"
                component={ComponentGalleryScreen}
              />
            ) : null}
            <Stack.Screen name="Chats" component={ChatsScreen} />
            <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
            <Stack.Screen
              name="NewMessage"
              component={NewMessageScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="Create"
              component={CreateScreen}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Group
              screenOptions={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            >
              <Stack.Screen
                name="CreatePostCrop"
                component={CreatePostCropScreen}
              />
              <Stack.Screen name="CreateStory" component={CreateStoryScreen} />
              <Stack.Screen name="ShareStory" component={ShareStoryScreen} />
              <Stack.Screen name="CreateReel" component={CreateReelScreen} />
              <Stack.Screen
                name="CreatePostDetails"
                component={CreatePostDetailsScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
            </Stack.Group>
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { alignSelf: 'center', marginBottom: 32 },
});
