import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExploreScreen from '../screens/main/ExploreScreen';
import BubbleDetailsScreen from '../screens/main/BubbleDetailsScreen';
import BubbleMembersScreen from '../screens/main/BubbleMembersScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';
import EventDetailsScreen from '../screens/main/EventDetailsScreen';
import CampusJoinScreen from '../screens/main/CampusJoinScreen';
import CampusVerifyScreen from '../screens/main/CampusVerifyScreen';
import EditBubbleScreen from '../screens/main/EditBubbleScreen';
import EditEventScreen from '../screens/main/EditEventScreen';
import BubbleEventsScreen from '../screens/main/BubbleEventsScreen';
import CreateBubbleScreen from '../screens/main/CreateBubbleScreen';
import EventParticipantsScreen from '../screens/main/EventParticipantsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import BulletinBoardScreen from '../screens/main/BulletinBoardScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import CreatePostScreen from '../screens/main/CreatePostScreen';

export type BubbleData = {
  id: string;
  title: string;
  category: string;
  distance?: string;
  image?: string;
  tagline?: string;
  description?: string;
  members?: number;
  privacy?: string;
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
  BubbleEvents: { bubbleId: string; bubbleTitle: string };
  CreateBubble: undefined;
  CreateEvent: { bubbleId?: string; bubbleTitle?: string };
  EventDetails: { eventId: string; event?: EventData; bubbleTitle?: string; source?: string; bubbleId?: string };
  CampusJoin: undefined;
  CampusVerify: { email: string; campusName: string };
  EditBubble: { bubble: BubbleData };
  EditEvent: { event: EventData };
  EventParticipants: { eventId: string; eventTitle: string; bubbleId: string; bubbleTitle: string };
  Notifications: undefined;
  BulletinBoard: { bubbleId: string; bubbleTitle: string };
  PostDetail: { postId: string; bubbleId: string };
  CreatePost: { bubbleId: string; bubbleTitle: string; preselectedTypeId?: number };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ExploreList" component={ExploreScreen} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreen} />
      <Stack.Screen name="BubbleMembers" component={BubbleMembersScreen} />
      <Stack.Screen name="BubbleEvents" component={BubbleEventsScreen} />
      <Stack.Screen name="CreateBubble" component={CreateBubbleScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="CampusJoin" component={CampusJoinScreen} />
      <Stack.Screen name="CampusVerify" component={CampusVerifyScreen} />
      <Stack.Screen name="EditBubble" component={EditBubbleScreen} />
      <Stack.Screen name="EditEvent" component={EditEventScreen} />
      <Stack.Screen name="EventParticipants" component={EventParticipantsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="BulletinBoard" component={BulletinBoardScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
    </Stack.Navigator>
  );
}
