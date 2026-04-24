# Bubble Mobile App

React Native mobile app for Bubble - local community building platform.

## Prerequisites

- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- iOS Simulator (Mac only) or Android Studio (for Android development)
- Expo Go app on your physical device (optional)

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `mobile` directory:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

**Important**: Replace `YOUR_COMPUTER_IP` with your actual local IP address (not localhost) so the mobile app can connect to the backend server.

#### Crash Reporting (Sentry)

The app uses Sentry to capture and report screen-level crashes to the team. `ScreenErrorBoundary` automatically sends every caught error to Sentry, tagged with the screen context so issues appear grouped in the Sentry dashboard.

To enable crash reporting:

1. Create a project in [Sentry](https://sentry.io) (React Native platform).
2. Copy the **DSN** from your project's *Settings → Client Keys*.
3. Set `SENTRY_DSN` in your `.env` file (see above) or as an environment secret in your CI/CD pipeline.

`app.config.js` reads `SENTRY_DSN` and passes it to the app at build time via `Constants.expoConfig.extra.sentryDsn`. If the variable is not set, Sentry is silently disabled and a warning is printed to the console — all other app functionality is unaffected.

For production builds (EAS Build / standalone), add `SENTRY_DSN` to your EAS secret environment variables so it is baked into the release bundle.

### 3. Start the Backend Server

In the main project directory (not mobile/):

```bash
npm install
npm run dev
```

The backend will run on `http://localhost:3000`

### 4. Start Expo Development Server

In the `mobile/` directory:

```bash
npm start
```

This will open the Expo Developer Tools in your browser.

### 5. Run on Device/Simulator

Choose one of the following options:

#### Option A: iOS Simulator (Mac only)
Press `i` in the terminal or click "Run on iOS simulator" in Expo DevTools

#### Option B: Android Emulator
Press `a` in the terminal or click "Run on Android device/emulator" in Expo DevTools

#### Option C: Physical Device (Easiest)
1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in the terminal
3. App will load on your device

## Project Structure

```
mobile/
├── src/
│   ├── navigation/       # Navigation setup (Auth & Main flows)
│   ├── screens/          # All screen components
│   │   ├── auth/         # Signup, Interests, Guidelines
│   │   └── main/         # Explore, MyBubbles, Messages
│   ├── services/         # API & CometChat services
│   ├── types/            # TypeScript type definitions
│   ├── constants/        # App constants
│   └── assets/           # Images, fonts, etc.
├── App.tsx               # Root component
└── package.json
```

## Key Features Implemented

✅ Auth Flow (Signup → Interests → Guidelines)
✅ Bottom Tab Navigation
✅ Explore Bubbles Screen
✅ My Bubbles Screen
✅ Messages Screen (placeholder)
✅ CometChat Integration (ready for real-time chat)
✅ API Service (connects to backend)

## Development Notes

### Navigation Flow
- App starts on **Auth Flow** (Signup screen)
- After completing auth, navigates to **Main Flow** (Bottom tabs)
- Bottom tabs: Explore, Upcoming, Bubbles, Messages, Profile

### Styling
- Uses NativeWind (Tailwind CSS for React Native)
- Custom blue gradient theme matching web design
- iOS/Android-style components

### CometChat Integration
- Initialize on app launch
- Create user on signup
- Create group chat when bubble is created
- Join/leave groups when joining/leaving bubbles

## Next Steps

1. **Install dependencies locally**:
   ```bash
   cd mobile && npm install
   ```

2. **Set up environment variables** with your IP and CometChat credentials

3. **Connect backend**: Ensure the Express server is running and accessible from your network

4. **Test on device**: Use Expo Go for quickest testing

5. **Implement remaining features**:
   - Bubble details screen
   - Chat screen with CometChat UI
   - Create bubble flow
   - Image uploads
   - Push notifications

## Troubleshooting

### "Network request failed"
- Check that EXPO_PUBLIC_API_URL points to your computer's IP (not localhost)
- Ensure backend server is running
- Device and computer must be on same network

### CometChat errors
- Verify credentials in `.env`
- Check CometChat dashboard for app status
- Ensure CometChat SDK is properly initialized

### Build errors
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Update Expo: `npm install expo@latest`

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [CometChat React Native SDK](https://www.cometchat.com/docs/react-native-chat-sdk/overview)
- [NativeWind](https://www.nativewind.dev/)
