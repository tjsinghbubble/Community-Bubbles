import Constants from "expo-constants";

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://community-bubbles.replit.app";

export const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  "AIzaSyAARfHAEQXSj0LS0fTael9QLXJYryHj2a8";
