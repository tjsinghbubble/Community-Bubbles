const baseConfig = require('./app.json');
const fs = require('fs');
const path = require('path');

// Expo does NOT load .env into process.env when evaluating app.config.js during
// prebuild — only the shell/system environment is visible here. This function
// reads .env explicitly so the Google iOS URL scheme can be computed correctly.
function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (_) {
    // No .env file — rely on system environment (EAS build, CI, etc.)
  }
}
loadDotEnv();

const appVersion = baseConfig.expo.version;
// Single source of truth: buildNumber in app.json drives iOS buildNumber,
// Android versionCode, and the in-app display (extra.buildNumber).
// EAS_BUILD_BUILD_NUMBER can override it during EAS cloud builds if needed.
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER || baseConfig.expo.buildNumber || '1';
const releaseSlug = buildNumber ? `${appVersion}+${buildNumber}` : appVersion;

// Derive the iOS URL scheme from the iOS client ID env var.
// Google's reversed client ID scheme: "com.googleusercontent.apps.<id-without-suffix>"
// The env var should be the full client ID string, e.g.
// "123456789-abcdefgh.apps.googleusercontent.com"
// which reverses to "com.googleusercontent.apps.123456789-abcdefgh"
function buildGoogleIosUrlScheme() {
  const envScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (envScheme) return envScheme;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  if (!iosClientId) return undefined;
  // Strip ".apps.googleusercontent.com" suffix
  const stripped = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${stripped}`;
}

module.exports = {
  ...baseConfig.expo,

  updates: {
    url: 'https://u.expo.dev/87aa84ba-0626-4ec1-b569-7276843813d9',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },

  ios: {
    ...baseConfig.expo.ios,
    buildNumber: String(buildNumber),
  },

  android: {
    ...baseConfig.expo.android,
    versionCode: parseInt(buildNumber, 10),
  },

  plugins: [
    ...baseConfig.expo.plugins
      .filter((p) => p !== '@sentry/react-native')
      // Replace the static Google plugin entry with the env-aware version
      .map((p) => {
        const name = Array.isArray(p) ? p[0] : p;
        if (name === '@react-native-google-signin/google-signin') {
          const scheme = buildGoogleIosUrlScheme();
          return scheme
            ? ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]
            : '@react-native-google-signin/google-signin';
        }
        return p;
      }),
    './plugins/withCxx20',
    './plugins/withGradleWrapper',
    './plugins/withModularHeaders',
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
    crashReporterUrl: process.env.CRASH_REPORTER_URL ?? '',
    eas: {
      projectId: '87aa84ba-0626-4ec1-b569-7276843813d9',
    },
    appEnv: process.env.APP_ENV ?? process.env.EAS_BUILD_PROFILE ?? 'development',
    expoSdkVersion: '55',
    cometChatVersion: '4.0.10',
    buildNumber: buildNumber || null,
  },
};
