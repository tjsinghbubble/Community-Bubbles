import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';
import MyBubblesScreen from '../screens/main/MyBubblesScreen';
import CreateBubbleScreen from '../screens/main/CreateBubbleScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';

export type BubblesStackParamList = {
  MyBubblesList: undefined;
  CreateBubble: undefined;
  CreateEvent: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<BubblesStackParamList>();

function MyBubblesScreenWithBoundary(props: React.ComponentProps<typeof MyBubblesScreen>) {
  return (
    <ScreenErrorBoundary context="MyBubblesScreen" message="Couldn't load your bubbles — tap to retry">
      <MyBubblesScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export default function BubblesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="MyBubblesList" component={MyBubblesScreenWithBoundary} />
      <Stack.Screen name="CreateBubble" component={CreateBubbleScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
