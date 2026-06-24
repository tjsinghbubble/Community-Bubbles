import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
import UpcomingScreen from '../screens/main/UpcomingScreen';
import EventDetailsScreen from '../screens/main/EventDetailsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import EditEventScreen from '../screens/main/EditEventScreen';
import EventParticipantsScreen from '../screens/main/EventParticipantsScreen';
import BubbleDetailsScreen from '../screens/main/BubbleDetailsScreen';
import MemberProfileScreen from '../screens/main/MemberProfileScreen';
import { EventData } from './ExploreNavigator';

export type UpcomingStackParamList = {
  UpcomingList: undefined;
  EventDetails: {
    eventId: string;
    event?: EventData;
    bubbleTitle?: string;
    source?: string;
    bubbleId?: string;
    highlightTaskId?: string;
    scrollToRsvp?: boolean;
    onTasksChanged?: (eventId: string, openCount: number) => void;
  };
  Notifications: undefined;
  EditEvent: { event: EventData };
  EventParticipants: { eventId: string; eventTitle: string; bubbleId: string; bubbleTitle: string };
  BubbleDetails: { bubble: any };
  MemberProfile: { userId: string };
};

const Stack = createNativeStackNavigator<UpcomingStackParamList>();

function UpcomingScreenWithBoundary(props: React.ComponentProps<typeof UpcomingScreen>) {
  return (
    <ScreenErrorBoundary context="UpcomingScreen" message="Couldn't load upcoming events — tap to retry">
      <UpcomingScreen {...props} />
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

function NotificationsScreenWithBoundary(props: React.ComponentProps<typeof NotificationsScreen>) {
  return (
    <ScreenErrorBoundary context="NotificationsScreen" message="Couldn't load notifications — tap to retry">
      <NotificationsScreen {...props} />
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

function BubbleDetailsScreenWithBoundary(props: React.ComponentProps<typeof BubbleDetailsScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleDetailsScreen" message="Couldn't load this bubble — tap to retry">
      <BubbleDetailsScreen {...props} />
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

export default function UpcomingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="UpcomingList" component={UpcomingScreenWithBoundary} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreenWithBoundary} />
      <Stack.Screen name="EditEvent" component={EditEventScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="EventParticipants" component={EventParticipantsScreenWithBoundary} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreenWithBoundary} options={{ gestureEnabled: false }} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreenWithBoundary} />
    </Stack.Navigator>
  );
}
