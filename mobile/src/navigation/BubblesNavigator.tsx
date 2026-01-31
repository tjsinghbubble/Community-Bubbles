import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyBubblesScreen from '../screens/main/MyBubblesScreen';
import CreateBubbleScreen from '../screens/main/CreateBubbleScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';

export type BubblesStackParamList = {
  MyBubblesList: undefined;
  CreateBubble: undefined;
  CreateEvent: undefined;
};

const Stack = createNativeStackNavigator<BubblesStackParamList>();

export default function BubblesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MyBubblesList" component={MyBubblesScreen} />
      <Stack.Screen name="CreateBubble" component={CreateBubbleScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
    </Stack.Navigator>
  );
}
