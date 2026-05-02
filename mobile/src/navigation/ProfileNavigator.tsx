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
import FeedbackFormScreen from '../screens/main/FeedbackFormScreen';
import ReportConcernScreen from '../screens/main/ReportConcernScreen';
import ManageRulesScreen from '../screens/main/ManageRulesScreen';
import CategoryPlaceholdersScreen from '../screens/main/CategoryPlaceholdersScreen';
import ErrorLogScreen from '../screens/main/ErrorLogScreen';
import SlowCallTrendsScreen from '../screens/main/SlowCallTrendsScreen';
import SpanHealthScreen from '../screens/main/SpanHealthScreen';
import TermsOfServiceScreen from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/auth/PrivacyPolicyScreen';
import NotificationPreferencesScreen from '../screens/main/NotificationPreferencesScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ViewProfile: undefined;
  EditProfile: { focusField?: 'photo' | 'bio' | 'interests' } | undefined;
  MyBubblesFromProfile: undefined;
  PendingReviews: undefined;
  Notifications: undefined;
  AccountSettings: undefined;
  NotificationPreferences: undefined;
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
  FeedbackForm: {
    type: 'feature' | 'defect' | 'help';
    title: string;
    subtitle: string;
    placeholder: string;
    successTitle: string;
    successSubtitle: string;
    buttonLabel: string;
  };
  ReportConcern: undefined;
  ManageRules: undefined;
  CategoryPlaceholders: undefined;
  ErrorLog: undefined;
  SlowCallTrends: undefined;
  SpanHealth: undefined;
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

function MyBubblesFromProfileScreenWithBoundary(props: React.ComponentProps<typeof MyBubblesFromProfileScreen>) {
  return (
    <ScreenErrorBoundary context="MyBubblesFromProfileScreen" message="Couldn't load your bubbles — tap to retry">
      <MyBubblesFromProfileScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function PendingReviewsScreenWithBoundary(props: React.ComponentProps<typeof PendingReviewsScreen>) {
  return (
    <ScreenErrorBoundary context="PendingReviewsScreen" message="Couldn't load pending reviews — tap to retry">
      <PendingReviewsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function NotificationsScreenWithBoundary(props: React.ComponentProps<typeof NotificationsScreen>) {
  return (
    <ScreenErrorBoundary context="NotificationsScreen" message="Couldn't load notifications — tap to retry">
      <NotificationsScreen {...props} />
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

function PersonalInformationScreenWithBoundary(props: React.ComponentProps<typeof PersonalInformationScreen>) {
  return (
    <ScreenErrorBoundary context="PersonalInformationScreen" message="Couldn't load personal information — tap to retry">
      <PersonalInformationScreen {...props} />
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

function DeactivateReasonScreenWithBoundary(props: React.ComponentProps<typeof DeactivateReasonScreen>) {
  return (
    <ScreenErrorBoundary context="DeactivateReasonScreen" message="Couldn't load deactivation options — tap to retry">
      <DeactivateReasonScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function DeactivateConfirmScreenWithBoundary(props: React.ComponentProps<typeof DeactivateConfirmScreen>) {
  return (
    <ScreenErrorBoundary context="DeactivateConfirmScreen" message="Couldn't load deactivation confirmation — tap to retry">
      <DeactivateConfirmScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function PrivacyScreenWithBoundary(props: React.ComponentProps<typeof PrivacyScreen>) {
  return (
    <ScreenErrorBoundary context="PrivacySettingsScreen" message="Couldn't load privacy settings — tap to retry">
      <PrivacyScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function DataRequestReasonScreenWithBoundary(props: React.ComponentProps<typeof DataRequestReasonScreen>) {
  return (
    <ScreenErrorBoundary context="DataRequestReasonScreen" message="Couldn't load data request options — tap to retry">
      <DataRequestReasonScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function DataConfirmAccountScreenWithBoundary(props: React.ComponentProps<typeof DataConfirmAccountScreen>) {
  return (
    <ScreenErrorBoundary context="DataConfirmAccountScreen" message="Couldn't load account confirmation — tap to retry">
      <DataConfirmAccountScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function GetHelpScreenWithBoundary(props: React.ComponentProps<typeof GetHelpScreen>) {
  return (
    <ScreenErrorBoundary context="GetHelpScreen" message="Couldn't load help options — tap to retry">
      <GetHelpScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function GiveFeedbackScreenWithBoundary(props: React.ComponentProps<typeof GiveFeedbackScreen>) {
  return (
    <ScreenErrorBoundary context="GiveFeedbackScreen" message="Couldn't load feedback form — tap to retry">
      <GiveFeedbackScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function HelpCenterScreenWithBoundary(props: React.ComponentProps<typeof HelpCenterScreen>) {
  return (
    <ScreenErrorBoundary context="HelpCenterScreen" message="Couldn't load the help center — tap to retry">
      <HelpCenterScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function FeedbackFormScreenWithBoundary(props: React.ComponentProps<typeof FeedbackFormScreen>) {
  return (
    <ScreenErrorBoundary context="FeedbackFormScreen" message="Couldn't load the form — tap to retry">
      <FeedbackFormScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function ReportConcernScreenWithBoundary(props: React.ComponentProps<typeof ReportConcernScreen>) {
  return (
    <ScreenErrorBoundary context="ReportConcernScreen" message="Couldn't load report concern — tap to retry">
      <ReportConcernScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function ManageRulesScreenWithBoundary(props: React.ComponentProps<typeof ManageRulesScreen>) {
  return (
    <ScreenErrorBoundary context="ManageRulesScreen" message="Couldn't load rules — tap to retry">
      <ManageRulesScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CategoryPlaceholdersScreenWithBoundary(props: React.ComponentProps<typeof CategoryPlaceholdersScreen>) {
  return (
    <ScreenErrorBoundary context="CategoryPlaceholdersScreen" message="Couldn't load category placeholders — tap to retry">
      <CategoryPlaceholdersScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function ErrorLogScreenWithBoundary(props: React.ComponentProps<typeof ErrorLogScreen>) {
  return (
    <ScreenErrorBoundary context="ErrorLogScreen" message="Couldn't load the error log — tap to retry">
      <ErrorLogScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function SlowCallTrendsScreenWithBoundary(props: React.ComponentProps<typeof SlowCallTrendsScreen>) {
  return (
    <ScreenErrorBoundary context="SlowCallTrendsScreen" message="Couldn't load slow call trends — tap to retry">
      <SlowCallTrendsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function SpanHealthScreenWithBoundary(props: React.ComponentProps<typeof SpanHealthScreen>) {
  return (
    <ScreenErrorBoundary context="SpanHealthScreen" message="Couldn't load span health — tap to retry">
      <SpanHealthScreen {...props} />
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

function NotificationPreferencesScreenWithBoundary(props: React.ComponentProps<typeof NotificationPreferencesScreen>) {
  return (
    <ScreenErrorBoundary context="NotificationPreferencesScreen" message="Couldn't load notification preferences — tap to retry">
      <NotificationPreferencesScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreenWithBoundary} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreenWithBoundary} />
      <Stack.Screen name="EditProfile" component={EditProfileScreenWithBoundary} />
      <Stack.Screen name="MyBubblesFromProfile" component={MyBubblesFromProfileScreenWithBoundary} />
      <Stack.Screen name="PendingReviews" component={PendingReviewsScreenWithBoundary} />
      <Stack.Screen name="Notifications" component={NotificationsScreenWithBoundary} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreenWithBoundary} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreenWithBoundary} />
      <Stack.Screen name="LoginSecurity" component={LoginSecurityScreenWithBoundary} />
      <Stack.Screen name="DeactivateReason" component={DeactivateReasonScreenWithBoundary} />
      <Stack.Screen name="DeactivateConfirm" component={DeactivateConfirmScreenWithBoundary} />
      <Stack.Screen name="PrivacySettings" component={PrivacyScreenWithBoundary} />
      <Stack.Screen name="DataRequestReason" component={DataRequestReasonScreenWithBoundary} />
      <Stack.Screen name="DataConfirmAccount" component={DataConfirmAccountScreenWithBoundary} options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="GetHelp" component={GetHelpScreenWithBoundary} />
      <Stack.Screen name="GiveFeedback" component={GiveFeedbackScreenWithBoundary} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreenWithBoundary} />
      <Stack.Screen name="FeedbackForm" component={FeedbackFormScreenWithBoundary} />
      <Stack.Screen name="ReportConcern" component={ReportConcernScreenWithBoundary} />
      <Stack.Screen name="ManageRules" component={ManageRulesScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CategoryPlaceholders" component={CategoryPlaceholdersScreenWithBoundary} />
      <Stack.Screen name="ErrorLog" component={ErrorLogScreenWithBoundary} />
      <Stack.Screen name="SlowCallTrends" component={SlowCallTrendsScreenWithBoundary} />
      <Stack.Screen name="SpanHealth" component={SpanHealthScreenWithBoundary} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreenWithBoundary} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreenWithBoundary} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreenWithBoundary} />
    </Stack.Navigator>
  );
}
