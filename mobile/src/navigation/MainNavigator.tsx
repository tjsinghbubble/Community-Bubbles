import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import ExploreNavigator from './ExploreNavigator';
import MyBubblesScreen from '../screens/main/MyBubblesScreen';
import MessagesScreen from '../screens/main/MessagesScreen';

export type MainTabParamList = {
  Explore: undefined;
  Upcoming: undefined;
  MyBubbles: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title} - Coming Soon</Text>
    </View>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: 'hsl(210, 95%, 55%)',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen name="Explore" component={ExploreNavigator} />
      <Tab.Screen 
        name="Upcoming" 
        children={() => <PlaceholderScreen title="Upcoming" />} 
      />
      <Tab.Screen 
        name="MyBubbles" 
        component={MyBubblesScreen}
        options={{ title: 'Bubbles' }}
      />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen 
        name="Profile" 
        children={() => <PlaceholderScreen title="Profile" />} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
});
