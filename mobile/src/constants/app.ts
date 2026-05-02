import Constants from 'expo-constants';

export const APP_VERSION: string =
  Constants.expoConfig?.version ?? '0.1.0';

export const APP_STAGE: string =
  Constants.expoConfig?.extra?.appStage ?? 'Pre-Alpha (Internal Testing)';
