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

#### Sentry Alert Rules

Configure the following alert rules in **Sentry → Alerts → Create Alert** so the team is notified automatically when crashes spike:

**Rule 1 — New issue (immediate notification)**

| Setting | Value |
|---|---|
| Alert type | Issue alert |
| Condition | "A new issue is created" |
| Action | Send a Slack notification to `#bubble-alerts` (or email the on-call address — see destinations below) |
| Environment | `production` |

This fires once the very first time a brand-new crash type is seen, giving the team early warning before the issue accumulates volume.

**Rule 2 — Error volume spike (threshold alert)**

| Setting | Value |
|---|---|
| Alert type | Metric alert — Error rate |
| Metric | Number of errors |
| Threshold | CRITICAL when errors > **50 in 5 minutes**; WARNING when errors > **20 in 5 minutes** |
| Action | Slack `#bubble-alerts` for WARNING; Slack `#bubble-alerts` + email on-call for CRITICAL |
| Environment | `production` |

Adjust the thresholds to match your typical traffic baseline once the app has a few days of production data.

**Rule 3 — Regression (fixed issue re-appears)**

| Setting | Value |
|---|---|
| Alert type | Issue alert |
| Condition | "A previously resolved issue is seen again" (regression) |
| Action | Send a Slack notification to `#bubble-alerts` |
| Environment | `production` |

#### Alert Destinations

> **Action required:** Replace every placeholder below with real values before the rules go live.

| Destination | Details |
|---|---|
| **Slack channel** | `#bubble-alerts` *(rename to match your actual channel)* — connect via *Sentry → Settings → Integrations → Slack* and follow the OAuth flow |
| **On-call email** | `team@yourdomain.com` *(replace with your team's real distribution list)* — add via *Sentry → Settings → Notifications* |
| **PagerDuty** (optional) | Connect via *Sentry → Settings → Integrations → PagerDuty* if 24/7 paging is required for CRITICAL rules |

> **Tip:** To add the Slack integration, a Sentry org admin must visit *Settings → Integrations → Slack* in the Sentry dashboard, click **Add Workspace**, and authorise the target channel. After that, the channel name is available as an action in any alert rule.

#### Verifying alerts end-to-end

After creating the rules in the Sentry dashboard, do a one-time smoke test to confirm delivery:

1. Temporarily lower the metric-alert WARNING threshold to **1 error in 5 minutes**.
2. Trigger a test error from a development build:
   ```ts
   import * as Sentry from '@sentry/react-native';
   Sentry.captureException(new Error('Alert smoke test'));
   ```
3. Confirm the Slack message or email arrives within a few minutes.
4. Restore the threshold to its production value (`20 errors / 5 min` for WARNING).

Record the date of the test and who performed it in the Sentry alert rule description field so the team knows the rules have been validated.

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
