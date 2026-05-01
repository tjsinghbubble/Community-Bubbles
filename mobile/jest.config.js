module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['**/src/**/__tests__/**/*.test.(ts|tsx)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
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
    '^react-native$': '<rootDir>/../node_modules/react-native',
    '^react-native/(.*)': '<rootDir>/../node_modules/react-native/$1',
  },
};
