import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import MemberProfileScreen from '../screens/main/MemberProfileScreen';
import BubbleDetailsScreen from '../screens/main/BubbleDetailsScreen';
import { BubbleData } from './ExploreNavigator';

export type MessagesStackParamList = {
  MessagesList: { openGroupId?: string; openGroupName?: string } | undefined;
  Chat: { groupId: string; groupName: string };
  MemberProfile: { userId: string };
  BubbleDetails: { bubble: BubbleData };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

function MessagesScreenWithBoundary(props: React.ComponentProps<typeof MessagesScreen>) {
  return (
    <ScreenErrorBoundary context="MessagesScreen" message="Couldn't load your messages — tap to retry">
      <MessagesScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function ChatScreenWithBoundary(props: React.ComponentProps<typeof ChatScreen>) {
  return (
    <ScreenErrorBoundary context="ChatScreen" message="Couldn't load this chat — tap to retry">
      <ChatScreen {...props} />
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

function BubbleDetailsScreenWithBoundary(props: React.ComponentProps<typeof BubbleDetailsScreen>) {
  return (
    <ScreenErrorBoundary context="BubbleDetailsScreen" message="Couldn't load this bubble — tap to retry">
      <BubbleDetailsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function MessagesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
      <Stack.Screen name="MessagesList" component={MessagesScreenWithBoundary} />
      <Stack.Screen name="Chat" component={ChatScreenWithBoundary} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreenWithBoundary} />
      <Stack.Screen name="BubbleDetails" component={BubbleDetailsScreenWithBoundary} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
