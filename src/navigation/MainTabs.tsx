import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '@/screens/home/HomeScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { ReelsScreen } from '@/screens/reels/ReelsScreen';
import { SearchScreen } from '@/screens/search/SearchScreen';

import { BottomNav } from './BottomNav';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: Parameters<typeof BottomNav>[0]) => (
  <BottomNav {...props} />
);

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
