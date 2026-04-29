import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
import ProfileScreen from '../screens/main/ProfileScreen';
import ViewProfileScreen from '../screens/main/ViewProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import MyBubblesFromProfileScreen from '../screens/main/MyBubblesFromProfileScreen';
import PendingReviewsScreen from '../screens/main/PendingReviewsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import AccountSettingsScreen from '../screens/main/AccountSettingsScreen';
import PersonalInformationScreen from '../screens/main/PersonalInformationScreen';
import LoginSecurityScreen from '../screens/main/LoginSecurityScreen';
import DeactivateReasonScreen from '../screens/main/DeactivateReasonScreen';
import DeactivateConfirmScreen from '../screens/main/DeactivateConfirmScreen';
import PrivacyScreen from '../screens/main/PrivacyScreen';
import DataRequestReasonScreen from '../screens/main/DataRequestReasonScreen';
import DataConfirmAccountScreen from '../screens/main/DataConfirmAccountScreen';
import GetHelpScreen from '../screens/main/GetHelpScreen';
import GiveFeedbackScreen from '../screens/main/GiveFeedbackScreen';
import HelpCenterScreen from '../screens/main/HelpCenterScreen';
import ReportConcernScreen from '../screens/main/ReportConcernScreen';
import ManageRulesScreen from '../screens/main/ManageRulesScreen';
import CategoryPlaceholdersScreen from '../screens/main/CategoryPlaceholdersScreen';
import ErrorLogScreen from '../screens/main/ErrorLogScreen';
import SlowCallTrendsScreen from '../screens/main/SlowCallTrendsScreen';
import TermsOfServiceScreen from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/auth/PrivacyPolicyScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ViewProfile: undefined;
  EditProfile: undefined;
  MyBubblesFromProfile: undefined;
  PendingReviews: undefined;
  Notifications: undefined;
  AccountSettings: undefined;
  PersonalInformation: undefined;
  LoginSecurity: undefined;
  DeactivateReason: undefined;
  DeactivateConfirm: { reason: string };
  PrivacySettings: undefined;
  DataRequestReason: { flow: 'request' | 'delete' };
  DataConfirmAccount: { flow: 'request' | 'delete'; reason: string };
  GetHelp: undefined;
  GiveFeedback: undefined;
  HelpCenter: undefined;
  ReportConcern: undefined;
  ManageRules: undefined;
  CategoryPlaceholders: undefined;
  ErrorLog: undefined;
  SlowCallTrends: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileScreenWithBoundary(props: React.ComponentProps<typeof ProfileScreen>) {
  return (
    <ScreenErrorBoundary context="ProfileScreen" message="Couldn't load your profile — tap to retry">
      <ProfileScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function ViewProfileScreenWithBoundary(props: React.ComponentProps<typeof ViewProfileScreen>) {
  return (
    <ScreenErrorBoundary context="ViewProfileScreen" message="Couldn't load your profile — tap to retry">
      <ViewProfileScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EditProfileScreenWithBoundary(props: React.ComponentProps<typeof EditProfileScreen>) {
  return (
    <ScreenErrorBoundary context="EditProfileScreen" message="Couldn't load edit profile — tap to retry">
      <EditProfileScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function AccountSettingsScreenWithBoundary(props: React.ComponentProps<typeof AccountSettingsScreen>) {
  return (
    <ScreenErrorBoundary context="AccountSettingsScreen" message="Couldn't load account settings — tap to retry">
      <AccountSettingsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function LoginSecurityScreenWithBoundary(props: React.ComponentProps<typeof LoginSecurityScreen>) {
  return (
    <ScreenErrorBoundary context="LoginSecurityScreen" message="Couldn't load login & security — tap to retry">
      <LoginSecurityScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreenWithBoundary} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreenWithBoundary} />
      <Stack.Screen name="EditProfile" component={EditProfileScreenWithBoundary} />
      <Stack.Screen name="MyBubblesFromProfile" component={MyBubblesFromProfileScreen} />
      <Stack.Screen name="PendingReviews" component={PendingReviewsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreenWithBoundary} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="LoginSecurity" component={LoginSecurityScreenWithBoundary} />
      <Stack.Screen name="DeactivateReason" component={DeactivateReasonScreen} />
      <Stack.Screen name="DeactivateConfirm" component={DeactivateConfirmScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacyScreen} />
      <Stack.Screen name="DataRequestReason" component={DataRequestReasonScreen} />
      <Stack.Screen name="DataConfirmAccount" component={DataConfirmAccountScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="GetHelp" component={GetHelpScreen} />
      <Stack.Screen name="GiveFeedback" component={GiveFeedbackScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="ReportConcern" component={ReportConcernScreen} />
      <Stack.Screen name="ManageRules" component={ManageRulesScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CategoryPlaceholders" component={CategoryPlaceholdersScreen} />
      <Stack.Screen name="ErrorLog" component={ErrorLogScreen} />
      <Stack.Screen name="SlowCallTrends" component={SlowCallTrendsScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
