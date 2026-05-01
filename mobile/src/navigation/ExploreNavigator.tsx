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
  EventDetails: { eventId: string; event?: EventData; bubbleTitle?: string; source?: string; bubbleId?: string; highlightTaskId?: string; scrollToRsvp?: boolean; onTasksChanged?: (eventId: string, openCount: number) => void };
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

function ExploreScreenWithBoundary(props: React.ComponentProps<typeof ExploreScreen>) {
  return (
    <ScreenErrorBoundary context="ExploreScreen" message="Couldn't load explore — tap to retry">
      <ExploreScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function BubbleDetailsScreenWithBoundary(props: React.ComponentProps<typeof BubbleDetailsScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleDetailsScreen" message="Couldn't load this bubble — tap to retry">
      <BubbleDetailsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function BubbleMembersScreenWithBoundary(props: React.ComponentProps<typeof BubbleMembersScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleMembersScreen" message="Couldn't load members — tap to retry">
      <BubbleMembersScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function BubbleEventsScreenWithBoundary(props: React.ComponentProps<typeof BubbleEventsScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleEventsScreen" message="Couldn't load bubble events — tap to retry">
      <BubbleEventsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CreateBubbleScreenWithBoundary(props: React.ComponentProps<typeof CreateBubbleScreen>) {
  return (
    <ScreenErrorBoundary context="CreateBubbleScreen" message="Couldn't load bubble creation — tap to retry">
      <CreateBubbleScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CreateEventScreenWithBoundary(props: React.ComponentProps<typeof CreateEventScreen>) {
  return (
    <ScreenErrorBoundary context="CreateEventScreen" message="Couldn't load event creation — tap to retry">
      <CreateEventScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EventDetailsScreenWithBoundary(props: React.ComponentProps<typeof EventDetailsScreen>) {
  return (
    <ScreenErrorBoundary context="EventDetailsScreen" message="Couldn't load this event — tap to retry">
      <EventDetailsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CampusJoinScreenWithBoundary(props: React.ComponentProps<typeof CampusJoinScreen>) {
  return (
    <ScreenErrorBoundary context="CampusJoinScreen" message="Couldn't load campus join — tap to retry">
      <CampusJoinScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CampusVerifyScreenWithBoundary(props: React.ComponentProps<typeof CampusVerifyScreen>) {
  return (
    <ScreenErrorBoundary context="CampusVerifyScreen" message="Couldn't load campus verification — tap to retry">
      <CampusVerifyScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EditBubbleScreenWithBoundary(props: React.ComponentProps<typeof EditBubbleScreen>) {
  return (
    <ScreenErrorBoundary context="EditBubbleScreen" message="Couldn't load bubble editor — tap to retry">
      <EditBubbleScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EditEventScreenWithBoundary(props: React.ComponentProps<typeof EditEventScreen>) {
  return (
    <ScreenErrorBoundary context="EditEventScreen" message="Couldn't load event editor — tap to retry">
      <EditEventScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EventParticipantsScreenWithBoundary(props: React.ComponentProps<typeof EventParticipantsScreen>) {
  return (
    <ScreenErrorBoundary context="EventParticipantsScreen" message="Couldn't load participants — tap to retry">
      <EventParticipantsScreen {...props} />
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

function BulletinBoardScreenWithBoundary(props: React.ComponentProps<typeof BulletinBoardScreen>) {
  return (
    <ScreenErrorBoundary context="BulletinBoardScreen" message="Couldn't load the bulletin board — tap to retry">
      <BulletinBoardScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function PostDetailScreenWithBoundary(props: React.ComponentProps<typeof PostDetailScreen>) {
  return (
    <ScreenErrorBoundary context="PostDetailScreen" message="Couldn't load this post — tap to retry">
      <PostDetailScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CreatePostScreenWithBoundary(props: React.ComponentProps<typeof CreatePostScreen>) {
  return (
    <ScreenErrorBoundary context="CreatePostScreen" message="Something went wrong creating your post — tap to retry">
      <CreatePostScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function JoinBubbleScreenWithBoundary(props: React.ComponentProps<typeof JoinBubbleScreen>) {
  return (
    <ScreenErrorBoundary context="JoinBubbleScreen" message="Couldn't load bubble join — tap to retry">
      <JoinBubbleScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function BubbleWaitlistScreenWithBoundary(props: React.ComponentProps<typeof BubbleWaitlistScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleWaitlistScreen" message="Couldn't load the waitlist — tap to retry">
      <BubbleWaitlistScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function AdminDashboardScreenWithBoundary(props: React.ComponentProps<typeof AdminDashboardScreen>) {
  return (
    <ScreenErrorBoundary context="AdminDashboardScreen" message="Couldn't load admin dashboard — tap to retry">
      <AdminDashboardScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function MemberProfileScreenWithBoundary(props: React.ComponentProps<typeof MemberProfileScreen>) {
  return (
    <ScreenErrorBoundary context="MemberProfileScreen" message="Couldn't load this member's profile — tap to retry">
      <MemberProfileScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function ExploreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="ExploreList" component={ExploreScreenWithBoundary} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="BubbleMembers" component={BubbleMembersScreenWithBoundary} />
      <Stack.Screen name="BubbleEvents" component={BubbleEventsScreenWithBoundary} />
      <Stack.Screen name="CreateBubble" component={CreateBubbleScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CampusJoin" component={CampusJoinScreenWithBoundary} />
      <Stack.Screen name="CampusVerify" component={CampusVerifyScreenWithBoundary} />
      <Stack.Screen name="EditBubble" component={EditBubbleScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="EditEvent" component={EditEventScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="EventParticipants" component={EventParticipantsScreenWithBoundary} />
      <Stack.Screen name="Notifications" component={NotificationsScreenWithBoundary} />
      <Stack.Screen name="BulletinBoard" component={BulletinBoardScreenWithBoundary} />
      <Stack.Screen name="PostDetail" component={PostDetailScreenWithBoundary} />
      <Stack.Screen name="CreatePost" component={CreatePostScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="JoinBubble" component={JoinBubbleScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="BubbleWaitlist" component={BubbleWaitlistScreenWithBoundary} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreenWithBoundary} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreenWithBoundary} />
    </Stack.Navigator>
  );
}
