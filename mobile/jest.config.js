module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/__tests__/**/*.test.(ts|tsx)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // These navigation tests require native module mocking incompatible with RN 0.83.x
    // jest-expo preset does not mock __fbBatchedBridgeConfig / StyleSheet.create correctly
    // for this RN version. Re-enable once test environment is updated.
    'UpcomingScreen.navigation.test',
    'EventDetailsScreen.navigation.test',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  modulePaths: ['<rootDir>/node_modules'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: './jest-babel.config.js',
        caller: { name: 'metro', bundler: 'metro', platform: 'ios' },
      },
    ],
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/../node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/../node_modules/react/jsx-runtime',
    '^react/jsx-dev-runtime$': '<rootDir>/../node_modules/react/jsx-dev-runtime',
    '^nativewind/jsx-runtime$': '<rootDir>/../node_modules/react/jsx-runtime',
    '^nativewind/jsx-dev-runtime$': '<rootDir>/../node_modules/react/jsx-dev-runtime',
    '^@react-native/assets-registry/registry$': '<rootDir>/node_modules/@react-native/assets-registry/registry.js',
  },
};
