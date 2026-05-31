import { requireEnv } from '../config/env';

export const COMETCHAT_CONSTANTS = {
  APP_ID: requireEnv('EXPO_PUBLIC_COMETCHAT_APP_ID', process.env.EXPO_PUBLIC_COMETCHAT_APP_ID),
  // Region is not a secret; 'us' is a safe default.
  REGION: process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'us',
};
