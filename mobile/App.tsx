import './global.css';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/Toast';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initSentry, installGlobalHandlers, hydrateSpanExpiryEvents, initOfflineRetry } from './src/utils/crashReporter';
import Constants from 'expo-constants';

// Suppress LogBox banners in dev builds — they render at the bottom of the
// screen and intercept touches on the FAB, breaking automated UI tests.
if (__DEV__) {
  LogBox.ignoreAllLogs();
}

initSentry();
installGlobalHandlers();
hydrateSpanExpiryEvents();

// Wire up offline crash-report retry. Reports that fail while the device is
// offline are queued in AsyncStorage and replayed when internet connectivity
// returns (via NetInfo) or the app foregrounds (via AppState).
const _crashServerUrl = Constants.expoConfig?.extra?.crashReporterUrl as string | undefined ?? null;
initOfflineRetry(_crashServerUrl);

const queryClient = new QueryClient();

export default function App() {
  return (
    <ErrorBoundary context="App">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <RootNavigator />
                <StatusBar style="auto" />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
