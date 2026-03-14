import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="MyBubblesFromProfile" component={MyBubblesFromProfileScreen} />
      <Stack.Screen name="PendingReviews" component={PendingReviewsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
      <Stack.Screen name="DeactivateReason" component={DeactivateReasonScreen} />
      <Stack.Screen name="DeactivateConfirm" component={DeactivateConfirmScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacyScreen} />
      <Stack.Screen name="DataRequestReason" component={DataRequestReasonScreen} />
      <Stack.Screen name="DataConfirmAccount" component={DataConfirmAccountScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="GetHelp" component={GetHelpScreen} />
      <Stack.Screen name="GiveFeedback" component={GiveFeedbackScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="ReportConcern" component={ReportConcernScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
