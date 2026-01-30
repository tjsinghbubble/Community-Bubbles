import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://bubble-ericmasiern1-ericmasiello.replit.app';
