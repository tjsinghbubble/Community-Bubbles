import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ExploreNavigator from './ExploreNavigator';
import BubblesNavigator from './BubblesNavigator';
import MessagesNavigator from './MessagesNavigator';
import ProfileNavigator from './ProfileNavigator';
import UpcomingScreen from '../screens/main/UpcomingScreen';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import cometChatService from '../services/cometchat.service';

export type MainTabParamList = {
  Explore: undefined;
  Upcoming: undefined;
  MyBubbles: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);
  const { user } = useAuth();
  const [adminCount, setAdminCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  const isAdmin = user?.isSuperAdmin === true;

  const fetchAdminCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await apiService.getAdminPendingCount();
      setAdminCount(count);
    } catch {
      setAdminCount(0);
    }
  }, [user]);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const count = await cometChatService.getTotalUnreadCount();
      setUnreadMessages(count);
    } catch {
      setUnreadMessages(0);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAdminCount();
      fetchUnreadMessages();
      const adminInterval = setInterval(fetchAdminCount, 30000);
      const msgInterval = setInterval(fetchUnreadMessages, 15000);
      return () => {
        clearInterval(adminInterval);
        clearInterval(msgInterval);
      };
    }, [fetchAdminCount, fetchUnreadMessages])
  );

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
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarActiveTintColor: 'hsl(210, 95%, 55%)',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen 
        name="Explore" 
        component={ExploreNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('Explore', { screen: 'ExploreList' });
          },
        })}
      />
      <Tab.Screen 
        name="Upcoming" 
        component={UpcomingScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="MyBubbles" 
        component={BubblesNavigator}
        options={{ 
          title: 'Bubbles',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('MyBubbles', { screen: 'MyBubblesList' });
          },
        })}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={size} color={color} />
              {unreadMessages > 0 && (
                <View style={badgeStyles.badge}>
                  <Text style={badgeStyles.badgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('Messages', { screen: 'MessagesList' });
          },
        })}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person-outline" size={size} color={color} />
              {adminCount > 0 && (
                <View style={badgeStyles.badge}>
                  <Text style={badgeStyles.badgeText}>{adminCount > 99 ? '99+' : adminCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('Profile', { screen: 'ProfileMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
