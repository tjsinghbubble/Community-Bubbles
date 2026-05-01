import React, { useState, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, CardShadow } from '../styles/theme';
import { NavigatorScreenParams, useFocusEffect } from '@react-navigation/native';
import ExploreNavigator from './ExploreNavigator';
import BubblesNavigator from './BubblesNavigator';
import MessagesNavigator from './MessagesNavigator';
import ProfileNavigator, { ProfileStackParamList } from './ProfileNavigator';
import UpcomingScreen from '../screens/main/UpcomingScreen';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import cometChatService from '../services/cometchat.service';
import { ExploreIcon, UpcomingIcon, BubblesIcon, MessagesIcon, ProfileIcon } from '../components/icons';
import unreadEvents from '../utils/unreadEvents';
import { useAppVersionCheck } from '../hooks/useAppVersionCheck';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';

const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/app/id6743069298'
  : 'https://play.google.com/store/apps/details?id=io.trybubble.app';

function UpcomingScreenWithBoundary(props: React.ComponentProps<typeof UpcomingScreen>) {
  return (
    <ScreenErrorBoundary context="UpcomingScreen" message="Couldn't load your upcoming events — tap to retry">
      <UpcomingScreen {...props} />
    </ScreenErrorBoundary>
  );
}

export type MainTabParamList = {
  Explore: undefined;
  Upcoming: undefined;
  MyBubbles: undefined;
  Messages: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);
  const { user } = useAuth();
  const [adminCount, setAdminCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { updateAvailable } = useAppVersionCheck();
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const showUpdateBanner = updateAvailable && !updateDismissed;

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
      const myBubbles = await apiService.getMyBubbles().catch(() => []);
      const approvedBubbleIds = new Set<string>((myBubbles as any[]).map((b: any) => String(b.id)));
      const count = await cometChatService.getPermissionFilteredUnreadCount(approvedBubbleIds);
      setUnreadMessages(count);
    } catch {
      setUnreadMessages(0);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = unreadEvents.onRefresh(() => {
      fetchUnreadMessages();
    });
    return unsubscribe;
  }, [fetchUnreadMessages]);

  useFocusEffect(
    useCallback(() => {
      fetchAdminCount();
      const adminInterval = setInterval(fetchAdminCount, 30000);
      return () => {
        clearInterval(adminInterval);
      };
    }, [fetchAdminCount])
  );

  return (
    <View style={bannerStyles.root}>
      {showUpdateBanner && (
        <View style={[bannerStyles.banner, { paddingTop: insets.top + Spacing.sm }]} testID="banner-update-nudge">
          <TouchableOpacity
            activeOpacity={0.85}
            style={bannerStyles.bannerCta}
            onPress={() => Linking.openURL(STORE_URL).catch(() => {})}
            testID="button-open-store"
          >
            <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" />
            <Text style={bannerStyles.bannerText}>Update available — tap to get the latest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUpdateDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="button-dismiss-update-nudge"
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: '#D9D9D9',
          ...CardShadow,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: Spacing.sm,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarLabelStyle: {
          fontSize: Typography.sizes.sm,
          fontWeight: Typography.weights.medium,
        },
      }}
    >
      <Tab.Screen 
        name="Explore" 
        component={ExploreNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <ExploreIcon size={size} color={color} />
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
        component={UpcomingScreenWithBoundary}
        options={{
          tabBarIcon: ({ color, size }) => (
            <UpcomingIcon size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="MyBubbles" 
        component={BubblesNavigator}
        options={{ 
          title: 'Bubbles',
          tabBarIcon: ({ color, size }) => (
            <BubblesIcon size={size} color={color} />
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
              <MessagesIcon size={size} color={color} />
              {unreadMessages > 0 && (
                <View style={badgeStyles.badge}>
                  <Text style={badgeStyles.badgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          focus: () => {
            fetchUnreadMessages();
          },
          blur: () => {
            fetchUnreadMessages();
          },
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
              <ProfileIcon size={size} color={color} />
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
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  banner: {
    backgroundColor: Colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  bannerCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.status.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  badgeText: {
    color: Colors.brand.skyWhite,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
});
