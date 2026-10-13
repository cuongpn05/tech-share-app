import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, Platform } from 'react-native';
import OwnerDrawerNavigator from './src/navigation/OwnerDrawerNavigator';
import { theme } from './src/theme/tokens';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
        translucent={Platform.OS === 'android'}
      />
      <OwnerDrawerNavigator />
    </NavigationContainer>
  );
}
