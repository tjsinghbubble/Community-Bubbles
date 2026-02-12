import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { apiService } from '../services/api.service';
import cometChatService from '../services/cometchat.service';

type User = {
  id: string;
  name: string;
  email: string;
  interests: string[];
  profilePhoto?: string | null;
  campusId?: string | null;
  campusEmail?: string | null;
  campusVerified?: boolean;
  dismissedCampusPrompt?: boolean;
  isSuperAdmin?: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Session tracking based on app state
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [token]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - start session
      if (token) {
        await startSession();
      }
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App going to background - end session
      await endSession();
    }
    appState.current = nextAppState;
  };

  const startSession = async () => {
    try {
      const response = await apiService.startSession() as { id: string };
      sessionIdRef.current = response.id;
    } catch (e) {
      console.log('Failed to start session:', e);
    }
  };

  const endSession = async () => {
    if (sessionIdRef.current) {
      try {
        await apiService.endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      } catch (e) {
        console.log('Failed to end session:', e);
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
        
        try {
          await cometChatService.loginUser(parsedUser.id, parsedUser.name);
        } catch (e) {
          console.log('CometChat login error:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
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
    
    try {
      await cometChatService.loginUser(response.user.id, response.user.name);
    } catch (e) {
      console.log('CometChat login error:', e);
    }
    
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
    
    try {
      await cometChatService.loginUser(response.user.id, response.user.name);
    } catch (e) {
      console.log('CometChat login error:', e);
    }
    
    // Start session on signup
    await startSession();
  };

  const logout = async () => {
    // End session on logout
    await endSession();
    
    try {
      await cometChatService.logoutUser();
    } catch (e) {
      console.log('CometChat logout error:', e);
    }
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
    apiService.setToken(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      apiService.setToken(token);
      const response = await apiService.getProfile();
      const updatedUser = response as any;
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
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
