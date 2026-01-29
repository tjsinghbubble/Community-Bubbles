import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignupScreen from '../screens/auth/SignupScreen';
import InterestsScreen from '../screens/auth/InterestsScreen';
import GuidelinesScreen from '../screens/auth/GuidelinesScreen';

export type AuthStackParamList = {
  Signup: undefined;
  Interests: { userId: string; name: string };
  Guidelines: { userId: string; interests: string[] };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="Signup"
    >
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreen} />
    </Stack.Navigator>
  );
}
