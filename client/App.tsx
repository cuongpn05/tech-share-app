import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AdminDrawerNavigator from './src/navigation/AdminDrawerNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AdminDrawerNavigator />
    </NavigationContainer>
  );
}
