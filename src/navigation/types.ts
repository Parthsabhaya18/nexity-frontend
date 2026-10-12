import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { SupportTicket } from '@/services/api/support';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Premium: { section?: 'messages' | 'crush' } | undefined;
  Reels: undefined;
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
  /** The draft lives in `postDraft`, not in params. */
  CreatePostCrop: undefined;
  CreatePostDetails: undefined;
  CreateStory: undefined;
  /** Preview of a post or reel before adding it to your story. */
  ShareStory: {
    kind: 'post' | 'reel';
    id: string;
    media_index: number;
    url: string;
    video: boolean;
    username: string;
    avatar_url: string | null;
    caption: string;
    aspect_ratio: number;
  };
  CreateReel: undefined;
  PostDetail: { postId: string };
  /** Swipe between the posts of a profile or the saved list; ids only. */
  PostViewer: {
    postId: string;
    source: 'user' | 'saved';
    userId?: string;
    /** The tapped tile is a saved reel, so `postId` is a reel id. */
    isReel?: boolean;
  };
  SavedPosts: undefined;
  Profile: undefined;
  EditProfile: undefined;
  UserProfile: { username: string };
  /** `username` is only for the header while the list loads. */
  Followers: {
    userId: string;
    username: string;
    tab: 'followers' | 'following';
  };
  FollowRequests: undefined;
  Settings: undefined;
  AccountInfo: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  ChangePassword: undefined;
  LoginSecurity: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
  ContactSent: { ticket: SupportTicket };
  SupportTicket: { ticket: SupportTicket };
  Legal: { doc: 'terms' | 'privacy' };
  BlockedAccounts: undefined;
  Notifications: undefined;
  Chats: undefined;
  /** `draft` prefills the composer (e.g. "Hi 👋" after a match). */
  ChatThread: { conversationId: string; draft?: string };
  NewMessage: undefined;
  /** `reason` picks the headline (what the user tried to do). */
  Plans:
    | { reason?: 'secret-read' | 'secret-send' | 'limit' | 'nearby' | 'crush' }
    | undefined;
  /** Payments (razorpay-payments.md §3). Ids only; never deep-linked. */
  Checkout: {
    planId: 'plus' | 'premium';
    period?: 'monthly' | 'quarterly' | 'yearly';
  };
  PaymentProcessing: { checkoutId: string };
  PurchaseSuccess: { checkoutId: string };
  PaymentFailed: { checkoutId: string };
  PaymentPending: { checkoutId: string };
  PayByQr: { checkoutId: string };
  Subscription: undefined;
  SecretPeoplePicker: { intent?: 'message' | 'crush' } | undefined;
  /** Fullscreen "It's a match 💘" celebration. */
  MatchCelebration: { matchId: string };
  SecretCompose: { username: string };
  SecretThread: { threadId: string };
  Nearby: undefined;
  NearbySettings: undefined;
  SecretBlocks: undefined;
  /** Dev builds only: shared component gallery. */
  DevComponents: undefined;
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
