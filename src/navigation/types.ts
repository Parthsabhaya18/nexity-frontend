import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Premium: undefined;
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
  };
  SavedPosts: undefined;
  Appearance: undefined;
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
  BlockedAccounts: undefined;
  Notifications: undefined;
  Chats: undefined;
  ChatThread: { conversationId: string };
  NewMessage: undefined;
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
