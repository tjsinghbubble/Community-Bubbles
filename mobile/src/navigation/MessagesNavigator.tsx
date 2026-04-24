import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';

export type MessagesStackParamList = {
  MessagesList: { openGroupId?: string; openGroupName?: string } | undefined;
  Chat: { groupId: string; groupName: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

function ChatScreenWithBoundary(props: React.ComponentProps<typeof ChatScreen>) {
  return (
    <ScreenErrorBoundary context="ChatScreen" message="Couldn't load this chat — tap to retry">
      <ChatScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function MessagesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreenWithBoundary} />
    </Stack.Navigator>
  );
}
