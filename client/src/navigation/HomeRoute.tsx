import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/home/HomeScreen';
import { BottomTabNavigator } from '../components/navigation/BottomTabNavigator';

export function HomeRoute({ onReturnToOwner }: { onReturnToOwner?: () => void } = {}) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1 }}>
    <HomeScreen showOwnerDashboard={!!onReturnToOwner} onNavigateToOwnerDashboard={onReturnToOwner} />
    <BottomTabNavigator activeTab="home" enabledTabs={['home']}
      onTabPress={() => {}} safeAreaBottom={insets.bottom} />
  </View>;
}

