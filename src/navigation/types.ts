import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
  Home: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
