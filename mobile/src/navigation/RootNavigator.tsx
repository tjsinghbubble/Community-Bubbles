import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import { navigationIntegration, reportError, withBackgroundTask } from '../utils/crashReporter';
import { showToast } from '../components/Toast';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const prefix = Linking.createURL('/');

const TASK_REMINDER_TYPES = new Set([
  'event_task_reminder_24h',
  'event_task_reminder_1h',
]);

const BUBBLE_REQUEST_TYPES = new Set([
  'bubble_request_approved',
  'bubble_request_rejected',
]);

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const raw = notification.request.content.data;
    const data: Record<string, unknown> = raw != null && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const type = typeof data.notificationType === 'string' ? data.notificationType : undefined;
    const isTaskReminder = !!type && TASK_REMINDER_TYPES.has(type);
    return {
      shouldShowAlert: !isTaskReminder,
      shouldPlaySound: !isTaskReminder,
      shouldSetBadge: false,
    };
  },
});

function buildLinking(shareBaseUrl?: string) {
  const prefixes = [prefix, 'bubble://'];
  if (shareBaseUrl) prefixes.push(shareBaseUrl);
  return {
    prefixes,
    config: {
      screens: {
        Main: {
          screens: {
            Explore: {
              screens: {
                BubbleDetails: 'b/:shortId',
              },
            },
          },
        },
      },
    },
  };
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [linkingConfig, setLinkingConfig] = useState(() => buildLinking());
  const pendingShortIdRef = useRef<string | null>(null);

  useEffect(() => {
    apiService.getShareBaseUrl()
      .then((res) => {
        if (res.baseUrl) {
          setLinkingConfig(buildLinking(res.baseUrl));
        }
      })
      .catch(() => {});
  }, []);

  const navigateToEventDetails = (params: Record<string, string>) => {
    const nav = navigationRef.current;
    if (!nav) return;
    (nav as any).navigate('Main', {
      screen: 'Explore',
      params: {
        screen: 'EventDetails',
        params,
      },
    });
  };

  const buildEventParamsFromData = (
    data: Record<string, unknown>,
  ): Record<string, string> | null => {
    const eventId = typeof data.eventId === 'string' ? data.eventId : undefined;
    if (!eventId) return null;

    const params: Record<string, string> = { eventId };
    if (typeof data.bubbleId === 'string') params.bubbleId = data.bubbleId;
    if (typeof data.bubbleName === 'string') params.bubbleTitle = data.bubbleName;

    const type = typeof data.notificationType === 'string' ? data.notificationType : undefined;
    const taskId = typeof data.taskId === 'string' ? data.taskId : undefined;
    if (type && TASK_REMINDER_TYPES.has(type) && taskId) {
      params.highlightTaskId = taskId;
    }

    return params;
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const raw = notification.request.content.data;
        const data: Record<string, unknown> = raw != null && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const type = typeof data.notificationType === 'string' ? data.notificationType : undefined;
        if (!type || !TASK_REMINDER_TYPES.has(type)) return;

        const eventParams = buildEventParamsFromData(data);
        const body =
          notification.request.content.body ||
          notification.request.content.title ||
          'Task reminder';

        showToast({
          message: body,
          type: 'info',
          duration: 6000,
          onPress: eventParams ? () => navigateToEventDetails(eventParams) : undefined,
        });
      },
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const raw = response.notification.request.content.data;
        const data: Record<string, unknown> = raw != null && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const type = typeof data.notificationType === 'string' ? data.notificationType : undefined;

        if (type && BUBBLE_REQUEST_TYPES.has(type)) {
          const bubbleId = typeof data.bubbleId === 'string' ? data.bubbleId : undefined;
          const bubbleName = typeof data.bubbleName === 'string' ? data.bubbleName : '';
          if (!bubbleId) return;
          const nav = navigationRef.current;
          if (!nav) return;
          const screen = type === 'bubble_request_approved' ? 'BubbleDetails' : 'JoinBubble';
          setTimeout(() => {
            (nav as any).navigate('Main', {
              screen: 'Explore',
              params: {
                screen,
                params: { bubble: { id: bubbleId, title: bubbleName, category: '' } },
              },
            });
          }, 300);
          return;
        }

        if (!type || !TASK_REMINDER_TYPES.has(type)) return;

        const eventParams = buildEventParamsFromData(data);
        if (!eventParams) return;

        setTimeout(() => navigateToEventDetails(eventParams), 300);
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated]);

  const navigateToBubble = async (shortId: string) => {
    try {
      const bubble = await apiService.getBubbleByShortId(shortId);
      if (!bubble) {
        Alert.alert('Bubble Not Found', 'This bubble no longer exists or may have been removed.');
        return;
      }

      if (bubble.deletedAt) {
        Alert.alert('Bubble Removed', 'This bubble no longer exists or may have been removed.');
        return;
      }

      const nav = navigationRef.current;
      if (nav) {
        (nav as any).navigate('Main', {
          screen: 'Explore',
          params: {
            screen: 'BubbleDetails',
            params: { bubble },
          },
        });
      }
    } catch (error: any) {
      if (error?.status === 404) {
        Alert.alert('Bubble Not Found', 'This bubble no longer exists or may have been removed.');
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        reportError(err, 'background.DeepLink.navigateToBubble');
        Alert.alert('Error', 'Unable to open this bubble link. Please try again.');
      }
    }
  };

  useEffect(() => {
    const handleDeepLink = (url: string) =>
      withBackgroundTask('DeepLink.handleUrl', async () => {
        const shortIdMatch = url.match(/\/b\/([a-zA-Z0-9]+)/);
        if (!shortIdMatch) return;

        const shortId = shortIdMatch[1];

        if (!isAuthenticated) {
          pendingShortIdRef.current = shortId;
          return;
        }

        await navigateToBubble(shortId);
      });

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink(url);
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        reportError(error, 'background.DeepLink.getInitialURL');
      });

    return () => subscription.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && pendingShortIdRef.current) {
      const shortId = pendingShortIdRef.current;
      pendingShortIdRef.current = null;
      setTimeout(() => {
        navigateToBubble(shortId);
      }, 500);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      onReady={() => navigationIntegration?.registerNavigationContainer(navigationRef)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
