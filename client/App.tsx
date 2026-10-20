import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { InAppNotificationBanner } from './src/components/notification/InAppNotificationBanner';

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar
            barStyle="dark-content"
          />
          <RootNavigator />
          <InAppNotificationBanner />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
