import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api.service';
import cometChatService from '../services/cometchat.service';

type User = {
  id: string;
  name: string;
  email: string;
  interests: string[];
  campusId?: string | null;
  campusEmail?: string | null;
  campusVerified?: boolean;
  dismissedCampusPrompt?: boolean;
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

  useEffect(() => {
    loadStoredAuth();
  }, []);

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
  };

  const logout = async () => {
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
