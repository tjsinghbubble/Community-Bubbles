import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
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
  EmailVerification: { email: string; name: string; password: string; gender: string; dateOfBirth: string; profilePhotoUri?: string };
  Interests: { name: string; email: string; password: string; gender: string; dateOfBirth: string; profilePhotoUri?: string; activeTab?: number; scrollOffset?: number };
  Guidelines: { name: string; email: string; password: string; gender: string; dateOfBirth: string; interests: string[]; profilePhotoUri?: string };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

function WelcomeScreenWithBoundary(props: React.ComponentProps<typeof WelcomeScreen>) {
  return (
    <ScreenErrorBoundary context="WelcomeScreen" message="Couldn't load the welcome screen — tap to retry">
      <WelcomeScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function SignupScreenWithBoundary(props: React.ComponentProps<typeof SignupScreen>) {
  return (
    <ScreenErrorBoundary context="SignupScreen" message="Couldn't load sign up — tap to retry">
      <SignupScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function LoginScreenWithBoundary(props: React.ComponentProps<typeof LoginScreen>) {
  return (
    <ScreenErrorBoundary context="LoginScreen" message="Couldn't load login — tap to retry">
      <LoginScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EmailVerificationScreenWithBoundary(props: React.ComponentProps<typeof EmailVerificationScreen>) {
  return (
    <ScreenErrorBoundary context="EmailVerificationScreen" message="Couldn't load email verification — tap to retry">
      <EmailVerificationScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function InterestsScreenWithBoundary(props: React.ComponentProps<typeof InterestsScreen>) {
  return (
    <ScreenErrorBoundary context="InterestsScreen" message="Couldn't load interests selection — tap to retry">
      <InterestsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function GuidelinesScreenWithBoundary(props: React.ComponentProps<typeof GuidelinesScreen>) {
  return (
    <ScreenErrorBoundary context="GuidelinesScreen" message="Couldn't load community guidelines — tap to retry">
      <GuidelinesScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function TermsOfServiceScreenWithBoundary(props: React.ComponentProps<typeof TermsOfServiceScreen>) {
  return (
    <ScreenErrorBoundary context="TermsOfServiceScreen" message="Couldn't load Terms of Service — tap to retry">
      <TermsOfServiceScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function PrivacyPolicyScreenWithBoundary(props: React.ComponentProps<typeof PrivacyPolicyScreen>) {
  return (
    <ScreenErrorBoundary context="PrivacyPolicyScreen" message="Couldn't load Privacy Policy — tap to retry">
      <PrivacyPolicyScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreenWithBoundary} />
      <Stack.Screen name="Signup" component={SignupScreenWithBoundary} />
      <Stack.Screen name="Login" component={LoginScreenWithBoundary} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreenWithBoundary} />
      <Stack.Screen name="Interests" component={InterestsScreenWithBoundary} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreenWithBoundary} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreenWithBoundary} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreenWithBoundary} />
    </Stack.Navigator>
  );
}
