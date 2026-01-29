import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: { groupId: string; groupName: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export default function MessagesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesList" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
