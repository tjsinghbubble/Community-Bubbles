import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/main/ProfileScreen';
import PendingReviewsScreen from '../screens/main/PendingReviewsScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PendingReviews: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PendingReviews" component={PendingReviewsScreen} />
    </Stack.Navigator>
  );
}
