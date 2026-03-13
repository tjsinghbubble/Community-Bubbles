import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/main/ProfileScreen';
import ViewProfileScreen from '../screens/main/ViewProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import PendingReviewsScreen from '../screens/main/PendingReviewsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import AccountSettingsScreen from '../screens/main/AccountSettingsScreen';
import PersonalInformationScreen from '../screens/main/PersonalInformationScreen';
import LoginSecurityScreen from '../screens/main/LoginSecurityScreen';
import DeactivateReasonScreen from '../screens/main/DeactivateReasonScreen';
import DeactivateConfirmScreen from '../screens/main/DeactivateConfirmScreen';
import TermsOfServiceScreen from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/auth/PrivacyPolicyScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ViewProfile: undefined;
  EditProfile: undefined;
  PendingReviews: undefined;
  Notifications: undefined;
  AccountSettings: undefined;
  PersonalInformation: undefined;
  LoginSecurity: undefined;
  DeactivateReason: undefined;
  DeactivateConfirm: { reason: string };
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
      <Stack.Screen name="PendingReviews" component={PendingReviewsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
      <Stack.Screen name="DeactivateReason" component={DeactivateReasonScreen} />
      <Stack.Screen name="DeactivateConfirm" component={DeactivateConfirmScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
