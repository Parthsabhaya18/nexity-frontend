import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/** For code outside screens (socket events) that needs to open a screen. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
