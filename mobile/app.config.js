const baseConfig = require('./app.json');

const appVersion = baseConfig.expo.version;
const buildNumber = process.env.EAS_BUILD_BUILD_NUMBER ?? '';
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
  // Strip ".apps.googleusercontent.com" suffix then reverse
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
