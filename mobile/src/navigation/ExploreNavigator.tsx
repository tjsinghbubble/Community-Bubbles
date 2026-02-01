import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExploreScreen from '../screens/main/ExploreScreen';
import BubbleDetailsScreen from '../screens/main/BubbleDetailsScreen';
import BubbleMembersScreen from '../screens/main/BubbleMembersScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';
import EventDetailsScreen from '../screens/main/EventDetailsScreen';

export type BubbleData = {
  id: string;
  title: string;
  category: string;
  distance?: string;
  image?: string;
  tagline?: string;
  description?: string;
  members?: number;
};

export type EventData = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  date: string;
  startTime: string;
  endTime?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  visibility?: string;
  attendeeLimit?: number | null;
  creatorId: string;
  bubbleId: string;
};

export type ExploreStackParamList = {
  ExploreList: undefined;
  BubbleDetails: { bubble: BubbleData };
  BubbleMembers: { bubbleId: string; bubbleTitle: string };
  CreateEvent: { bubbleId?: string; bubbleTitle?: string };
  EventDetails: { eventId: string; event?: EventData };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExploreList" component={ExploreScreen} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreen} />
      <Stack.Screen name="BubbleMembers" component={BubbleMembersScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
    </Stack.Navigator>
  );
}
