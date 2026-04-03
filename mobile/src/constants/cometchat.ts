export const COMETCHAT_CONSTANTS = {
  APP_ID: process.env.EXPO_PUBLIC_COMETCHAT_APP_ID || '1673948f1ffba3646',
  REGION: process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'us',
  // AUTH_KEY is kept only as a last-resort fallback for createUserIfNotExists.
  // Primary login flow uses server-generated auth tokens (POST /api/cometchat/auth-token).
  AUTH_KEY: process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY || '',
};
