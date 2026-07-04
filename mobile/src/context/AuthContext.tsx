import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, unstable_batchedUpdates } from 'react-native';
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
  socialAuthPending?: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, interests: string[]) => Promise<void>;
  loginWithSocialToken: (token: string, user: User) => Promise<void>;
  updateSocialUser: (updates: Partial<User>) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_THROTTLE_MS = 2 * 60 * 1000;

const SECURE_TOKEN_KEY = 'authToken_secure';
const SECURE_USER_KEY = 'user_secure';
const ASYNC_TOKEN_KEY = 'authToken';
const ASYNC_USER_KEY = 'user';
// Lives in the app container (AsyncStorage), which uninstall/reinstall — and Maestro
// clearState — DOES wipe, unlike the iOS Keychain backing SecureStore. Its absence
// alongside a Keychain token means the app was reinstalled: treat the surviving
// Keychain session as stale and drop it (a deleted app must not auto-login on
// reinstall; on-device e2e relies on clearState actually logging out).
const INSTALL_MARKER_KEY = 'installMarker';

async function saveAuthToSecureStore(token: string, user: User): Promise<void> {
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
  await SecureStore.setItemAsync(SECURE_USER_KEY, JSON.stringify(user));
}

async function clearAuthFromSecureStore(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SECURE_USER_KEY);
}

async function loadAuthFromStorage(): Promise<{ token: string; user: User } | null> {
  // 0. Fresh install (container wiped, Keychain possibly not): discard any surviving
  // Keychain session before reading it. Legacy AsyncStorage tokens are unaffected —
  // they only exist when the container survived, i.e. a genuine in-place update.
  try {
    if (!(await AsyncStorage.getItem(INSTALL_MARKER_KEY))) {
      await clearAuthFromSecureStore();
      await AsyncStorage.setItem(INSTALL_MARKER_KEY, '1');
    }
  } catch (e) {
    console.warn('[Auth] Install-marker check failed:', e);
  }

  // 1. Try SecureStore first (new storage)
  try {
    const secureToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    const secureUser = await SecureStore.getItemAsync(SECURE_USER_KEY);
    if (secureToken && secureUser) {
      return { token: secureToken, user: JSON.parse(secureUser) };
    }
  } catch (e) {
    console.warn('[Auth] SecureStore read failed, falling back to AsyncStorage:', e);
  }

  // 2. Migrate from AsyncStorage if SecureStore is empty
  try {
    const asyncToken = await AsyncStorage.getItem(ASYNC_TOKEN_KEY);
    const asyncUser = await AsyncStorage.getItem(ASYNC_USER_KEY);
    if (asyncToken && asyncUser) {
      const user = JSON.parse(asyncUser);
      // Migrate to SecureStore
      try {
        await saveAuthToSecureStore(asyncToken, user);
        await AsyncStorage.removeItem(ASYNC_TOKEN_KEY);
        await AsyncStorage.removeItem(ASYNC_USER_KEY);
        logAppEvent('[Auth] Migrated auth from AsyncStorage to SecureStore', {});
      } catch (migrateErr) {
        console.warn('[Auth] Migration to SecureStore failed:', migrateErr);
      }
      return { token: asyncToken, user };
    }
  } catch (e) {
    console.warn('[Auth] AsyncStorage read failed:', e);
  }

  return null;
}

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
    const timeout = setTimeout(() => {
      console.warn('[Auth] loadStoredAuth timed out — forcing isLoading=false');
      setIsLoading(false);
    }, 4000);

    try {
      const stored = await loadAuthFromStorage();
      if (stored) {
        const { token: storedToken, user: parsedUser } = stored;
        // Don't restore session if social auth is still pending
        if (parsedUser.socialAuthPending) {
          await clearAuthFromSecureStore();
        } else {
          setToken(storedToken);
          setUser(parsedUser);
          apiService.setToken(storedToken);
          apiService.setOnTokenRevoked(() => clearLocalAuth());
          setSentryUser(parsedUser.id, parsedUser.name, parsedUser.isSuperAdmin);
          logAppEvent('[Auth] Session restored from storage', { userId: parsedUser.id, name: parsedUser.name });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Auth] Failed to load stored auth:', err.message);
      reportError(err, 'background.loadStoredAuth');
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiService.login(email, password);
    await saveAuthToSecureStore(response.token, response.user);
    setToken(response.token);
    setUser(response.user);
    apiService.setToken(response.token);
    apiService.setOnTokenRevoked(() => clearLocalAuth());
    setSentryUser(response.user.id, response.user.name, response.user.isSuperAdmin);
    logAppEvent('[Auth] User logged in', { userId: response.user.id, name: response.user.name });
    await startSession();
  };

  const signup = async (name: string, email: string, password: string, interests: string[]) => {
    const response = await apiService.signup({ name, email, password, interests });
    await saveAuthToSecureStore(response.token, response.user);
    setToken(response.token);
    setUser(response.user);
    apiService.setToken(response.token);
    apiService.setOnTokenRevoked(() => clearLocalAuth());
    setSentryUser(response.user.id, response.user.name, response.user.isSuperAdmin);
    logAppEvent('[Auth] User signed up', { userId: response.user.id, name: response.user.name, interestCount: interests.length });
    await startSession();
  };

  // Called after Google or Apple auth returns a JWT and user object.
  // If the user has socialAuthPending=true they still need to complete
  // their profile — we store the token so requests work, but we don't
  // mark the session as fully authenticated until that's done.
  const loginWithSocialToken = async (socialToken: string, socialUser: User) => {
    apiService.setToken(socialToken);
    apiService.setOnTokenRevoked(() => clearLocalAuth());
    // Use unstable_batchedUpdates to guarantee both state updates commit in a
    // single render. Without this, a render between setToken and setUser could
    // briefly produce token=truthy + user=null → isAuthenticated=true, causing
    // RootNavigator to flip to the Main stack before we can navigate to SocialProfile.
    unstable_batchedUpdates(() => {
      setToken(socialToken);
      setUser(socialUser);
    });

    if (!socialUser.socialAuthPending) {
      // Fully authenticated — persist and start session
      await saveAuthToSecureStore(socialToken, socialUser);
      setSentryUser(socialUser.id, socialUser.name, socialUser.isSuperAdmin);
      logAppEvent('[Auth] Social login (existing user)', { userId: socialUser.id });
      await startSession();
    } else {
      // New user — keep token in memory only until profile is complete
      logAppEvent('[Auth] Social login (new user, pending profile)', { userId: socialUser.id });
    }
  };

  // Called by SocialProfileScreen after /complete-social-profile succeeds.
  // Updates the in-memory user without triggering navigation — AuthContext
  // will persist once the full signup flow (Interests → Guidelines) finishes.
  const updateSocialUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  const clearLocalAuth = async () => {
    apiService.setOnTokenRevoked(null);
    await clearAuthFromSecureStore();
    // Also clear legacy AsyncStorage just in case
    try {
      await AsyncStorage.removeItem(ASYNC_TOKEN_KEY);
      await AsyncStorage.removeItem(ASYNC_USER_KEY);
    } catch {}
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
    await endSession();
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
      await saveAuthToSecureStore(token, updatedUser);
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
    isAuthenticated: !!token && !user?.socialAuthPending,
    login,
    signup,
    loginWithSocialToken,
    updateSocialUser,
    logout,
    refreshUser,
  }), [user, token, isLoading, login, signup, loginWithSocialToken, updateSocialUser, logout, refreshUser]);

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
