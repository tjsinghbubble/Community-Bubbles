import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const prefix = Linking.createURL('/');

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

  useEffect(() => {
    apiService.getShareBaseUrl()
      .then((res) => {
        if (res.baseUrl) {
          setLinkingConfig(buildLinking(res.baseUrl));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const shortIdMatch = url.match(/\/b\/([a-zA-Z0-9]+)/);
      if (!shortIdMatch) return;

      const shortId = shortIdMatch[1];
      try {
        const bubble = await apiService.getBubbleByShortId(shortId);
        if (!bubble) {
          Alert.alert('Not Found', 'This bubble could not be found.');
          return;
        }

        const nav = navigationRef.current;
        if (nav && isAuthenticated) {
          (nav as any).navigate('Main', {
            screen: 'Explore',
            params: {
              screen: 'BubbleDetails',
              params: { bubble },
            },
          });
        }
      } catch (error) {
        console.error('Deep link error:', error);
        Alert.alert('Error', 'Unable to open this bubble link.');
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linkingConfig}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
