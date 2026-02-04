import Constants from "expo-constants";

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev" ||
  "https://community-bubbles.replit.app";

export const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  "AIzaSyAARfHAEQXSj0LS0fTael9QLXJYryHj2a8";
