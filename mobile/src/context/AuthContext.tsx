import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { apiService } from '../services/api.service';
import cometChatService from '../services/cometchat.service';
import { setSentryUser, clearSentryUser, logAppEvent, reportError, withBackgroundTask } from '../utils/crashReporter';

type User = {
  id: string;
  name: string;
  email: string;
  interests: string[];
  profilePhoto?: string | null;
  aboutMe?: string | null;
  campusId?: string | null;
  campusEmail?: string | null;
  campusVerified?: boolean;
  dismissedCampusPrompt?: boolean;
  isSuperAdmin?: boolean;
  updatedAt?: string | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, interests: string[]) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_THROTTLE_MS = 2 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Session tracking based on app state
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [token]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    withBackgroundTask('AppState.handleChange', async () => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (token) {
          await startSession();
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        await endSession();
      }
      appState.current = nextAppState;
    });
  };

  const startSession = async () => {
    try {
      const response = await apiService.startSession() as { id: string };
      sessionIdRef.current = response.id;
      logAppEvent('[Session] App session started', { sessionId: response.id });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn('[Session] Failed to start session:', err.message);
      reportError(err, 'background.AppState.startSession');
    }
  };

  const endSession = async () => {
    if (sessionIdRef.current) {
      try {
        logAppEvent('[Session] App session ended', { sessionId: sessionIdRef.current });
        await apiService.endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.warn('[Session] Failed to end session:', err.message);
        reportError(err, 'background.AppState.endSession');
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      await cometChatService.init();
      
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        apiService.setToken(storedToken);
        apiService.setOnTokenRevoked(() => clearLocalAuth());
        setSentryUser(parsedUser.id, parsedUser.name, parsedUser.isSuperAdmin);
        logAppEvent('[Auth] Session restored from storage', { userId: parsedUser.id, name: parsedUser.name });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Auth] Failed to load stored auth:', err.message);
      reportError(err, 'background.loadStoredAuth');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiService.login(email, password);
    await AsyncStorage.setItem('authToken', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    apiService.setToken(response.token);
    apiService.setOnTokenRevoked(() => clearLocalAuth());
    setSentryUser(response.user.id, response.user.name, response.user.isSuperAdmin);
    logAppEvent('[Auth] User logged in', { userId: response.user.id, name: response.user.name });
    // Start session on login
    await startSession();
  };

  const signup = async (name: string, email: string, password: string, interests: string[]) => {
    const response = await apiService.signup({ name, email, password, interests });
    await AsyncStorage.setItem('authToken', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    apiService.setToken(response.token);
    apiService.setOnTokenRevoked(() => clearLocalAuth());
    setSentryUser(response.user.id, response.user.name, response.user.isSuperAdmin);
    logAppEvent('[Auth] User signed up', { userId: response.user.id, name: response.user.name, interestCount: interests.length });
    // Start session on signup
    await startSession();
  };

  const clearLocalAuth = async () => {
    apiService.setOnTokenRevoked(null);
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
    apiService.setToken(null);
    clearSentryUser();
    try {
      await cometChatService.logoutUser();
    } catch (e) {
      console.log('CometChat logout error:', e);
    }
  };

  const logout = async () => {
    logAppEvent('[Auth] User logged out', { userId: user?.id ?? 'unknown' });
    // End session on logout
    await endSession();

    // Invalidate token server-side before clearing locally
    try {
      await apiService.serverLogout();
    } catch (e) {
      console.log('Server logout error:', e);
    }

    await clearLocalAuth();
  };

  const refreshUser = async () => {
    if (!token) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    try {
      apiService.setToken(token);
      const response = await apiService.getProfile();
      const updatedUser = response as any;
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setSentryUser(updatedUser.id, updatedUser.name, updatedUser.isSuperAdmin);
      lastRefreshRef.current = Date.now();
    } catch (error: any) {
      const isNetworkError =
        error?.message === 'Network request failed' ||
        error?.message?.includes('fetch') ||
        error?.name === 'TypeError';
      lastRefreshRef.current = Date.now();
      if (isNetworkError) {
        console.warn('refreshUser: server temporarily unreachable, using cached profile');
      } else {
        console.error('Failed to refresh user:', error);
      }
    }
  };

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    signup,
    logout,
    refreshUser,
  }), [user, token, isLoading, login, signup, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
