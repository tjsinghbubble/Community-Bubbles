import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
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
import JoinBubbleScreen from '../screens/main/JoinBubbleScreen';
import BubbleWaitlistScreen from '../screens/main/BubbleWaitlistScreen';
import AdminDashboardScreen from '../screens/main/AdminDashboardScreen';
import MemberProfileScreen from '../screens/main/MemberProfileScreen';

export type BubbleData = {
  id: string;
  title: string;
  category: string;
  distance?: string;
  image?: string;
  tagline?: string;
  description?: string;
  members?: number;
  memberLimit?: number | null;
  privacy?: string;
  campusId?: number | null;
  shortId?: string | null;
  coverImage?: string | null;
  images?: string[];
  locationName?: string | null;
  locationAddress?: string | null;
  locationLat?: string | null;
  locationLng?: string | null;
  radiusMiles?: number | null;
  creatorId?: string;
  status?: string;
  rules?: string[];
  deletedAt?: string | null;
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
  CreatePost: { bubbleId: string; bubbleTitle: string; preselectedTypeId?: number; editPostId?: string; editTitle?: string; editBody?: string };
  JoinBubble: { bubble: BubbleData };
  BubbleWaitlist: { bubbleId: string; bubbleTitle: string };
  AdminDashboard: { bubbleId: string; bubbleTitle: string; bubble: BubbleData };
  MemberProfile: { userId: string };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

function BubbleDetailsScreenWithBoundary(props: React.ComponentProps<typeof BubbleDetailsScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleDetailsScreen" message="Couldn't load this bubble — tap to retry">
      <BubbleDetailsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function BulletinBoardScreenWithBoundary(props: React.ComponentProps<typeof BulletinBoardScreen>) {
  return (
    <ScreenErrorBoundary context="BulletinBoardScreen" message="Couldn't load the bulletin board — tap to retry">
      <BulletinBoardScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function ExploreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="ExploreList" component={ExploreScreen} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreenWithBoundary} />
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
      <Stack.Screen name="BulletinBoard" component={BulletinBoardScreenWithBoundary} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="JoinBubble" component={JoinBubbleScreen} />
      <Stack.Screen name="BubbleWaitlist" component={BubbleWaitlistScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
    </Stack.Navigator>
  );
}
