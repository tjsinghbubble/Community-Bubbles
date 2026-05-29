import Constants from "expo-constants";
import { requireEnv } from "./env";

export const API_URL = requireEnv(
  "EXPO_PUBLIC_API_URL",
  Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL
);

export const GOOGLE_PLACES_API_KEY = requireEnv(
  "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY",
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
);
