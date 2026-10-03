import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Reels: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: { email?: string; notice?: string } | undefined;
  Register: undefined;
  VerifyEmail: {
    email: string;
    mode: 'register' | 'reset';
    resendIn?: number;
    devCode?: string;
  };
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string; resetToken: string };
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Create: undefined;
  Settings: undefined;
  Notifications: undefined;
  Chats: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
