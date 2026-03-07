import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import InterestsScreen from '../screens/auth/InterestsScreen';
import GuidelinesScreen from '../screens/auth/GuidelinesScreen';
import TermsOfServiceScreen from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/auth/PrivacyPolicyScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Signup: undefined;
  Login: undefined;
  EmailVerification: { email: string; name: string; password: string; gender: string; dateOfBirth: string };
  Interests: { name: string; email: string; password: string; gender: string; dateOfBirth: string };
  Guidelines: { name: string; email: string; password: string; gender: string; dateOfBirth: string; interests: string[] };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
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
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
