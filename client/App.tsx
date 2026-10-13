import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, Platform } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/theme/tokens';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
export default function App() {
  return <Provider store={store}><SafeAreaProvider><NavigationContainer>
    <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} translucent={Platform.OS === 'android'} />
    <RootNavigator />
  </NavigationContainer></SafeAreaProvider></Provider>;
}
