import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OwnerDrawerNavigator from './OwnerDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import { HomeRoute } from './HomeRoute';
export { HomeRoute } from './HomeRoute';
export type RootStackParamList = { Owner: undefined; Admin: undefined; Home: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>();
export function RootNavigator() {
  return <Stack.Navigator initialRouteName="Owner" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Owner" component={OwnerDrawerNavigator} />
    <Stack.Screen name="Admin" component={AdminDrawerNavigator} />
    <Stack.Screen name="Home" component={HomeRoute} />
  </Stack.Navigator>;
}
