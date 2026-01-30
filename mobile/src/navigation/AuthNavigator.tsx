import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import InterestsScreen from '../screens/auth/InterestsScreen';
import GuidelinesScreen from '../screens/auth/GuidelinesScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Signup: undefined;
  Login: undefined;
  Interests: { name: string; email: string; password: string; gender: string; dateOfBirth: string };
  Guidelines: { name: string; email: string; password: string; gender: string; dateOfBirth: string; interests: string[] };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreen} />
    </Stack.Navigator>
  );
}
