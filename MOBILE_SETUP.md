# Bubble - React Native Mobile App Setup Guide

This guide will help you set up and run the Bubble mobile app locally on your machine.

## Overview

The project now has two parts:
- **Backend Server** (`/server`, `/shared`) - Express API with PostgreSQL database
- **Mobile App** (`/mobile`) - React Native app built with Expo

## Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Expo CLI** - Install globally:
   ```bash
   npm install -g expo-cli
   ```
3. **Development Device**:
   - **iOS**: Mac with Xcode installed, OR iPhone with Expo Go app
   - **Android**: Android Studio with emulator, OR Android phone with Expo Go app
   - **Easiest option**: Physical device with Expo Go ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

## Part 1: Backend Setup (Already on Replit)

The backend is already set up and running on Replit with:
- ✅ PostgreSQL database
- ✅ User authentication (JWT)
- ✅ Bubbles API (create, list, join, leave)
- ✅ CometChat credentials configured

**Backend is accessible at**: The Replit URL when the workflow is running

## Part 2: Local Mobile Setup

### Step 1: Clone/Download the Mobile Folder

Download or sync the `/mobile` folder from this Replit to your local machine.

### Step 2: Install Dependencies

```bash
cd mobile
npm install
```

This will install all required packages including:
- React Native & Expo
- React Navigation
- CometChat SDK
- NativeWind (Tailwind for RN)
- TanStack Query

### Step 3: Configure Environment Variables

Create a `.env` file in the `/mobile` directory:

```env
# Backend API - Replace with your Replit backend URL
EXPO_PUBLIC_API_URL=https://YOUR_REPLIT_URL.replit.dev

# CometChat Credentials (already configured on backend)
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key
```

**Important Notes**:
- Replace `YOUR_REPLIT_URL` with the actual Replit URL for this project
- Get CometChat credentials from your CometChat dashboard
- The API URL must be HTTPS (Replit provides this automatically)

### Step 4: Start the Mobile App

```bash
cd mobile
npm start
```

This opens the Expo Developer Tools in your browser.

### Step 5: Run on Device

Choose ONE of these options:

#### Option A: Physical Device (Easiest & Recommended)

1. Install **Expo Go** on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scan the QR code** shown in your terminal or browser
   - iOS: Use Camera app
   - Android: Use Expo Go app scanner

3. App loads instantly on your device!

#### Option B: iOS Simulator (Mac Only)

1. Install Xcode from Mac App Store
2. Press `i` in the Expo terminal
3. Simulator launches automatically

#### Option C: Android Emulator

1. Install [Android Studio](https://developer.android.com/studio)
2. Set up an Android Virtual Device (AVD)
3. Start the emulator
4. Press `a` in the Expo terminal

## Testing the Complete Flow

### 1. Signup Flow
- App starts on **Signup** screen (as requested)
- Enter name, email, password
- Select interests (minimum 3)
- Accept community guidelines

### 2. Explore Bubbles
- View available bubbles in grid
- Tap to see details (coming soon)

### 3. Join & Chat
- Join a bubble
- Access group chat via CometChat
- Real-time messaging

## Project Structure

```
mobile/
├── src/
│   ├── navigation/
│   │   ├── RootNavigator.tsx      # Main navigator
│   │   ├── AuthNavigator.tsx      # Auth flow (Signup → Interests → Guidelines)
│   │   └── MainNavigator.tsx      # Bottom tabs (Explore, Bubbles, Messages, etc.)
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── SignupScreen.tsx
│   │   │   ├── InterestsScreen.tsx
│   │   │   └── GuidelinesScreen.tsx
│   │   └── main/
│   │       ├── ExploreScreen.tsx
│   │       ├── MyBubblesScreen.tsx
│   │       └── MessagesScreen.tsx
│   ├── services/
│   │   ├── api.service.ts         # Backend API client
│   │   └── cometchat.service.ts   # CometChat integration
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── constants/
│       └── cometchat.ts           # CometChat config
├── App.tsx                         # Root component
├── package.json
└── .env                            # Your environment config
```

## Available Features

### ✅ Implemented
- Complete auth flow (Signup → Interests → Guidelines)
- Bottom tab navigation
- Explore Bubbles screen
- My Bubbles screen
- Messages placeholder
- Backend API integration
- CometChat SDK integrated

### 🚧 Next Steps (For You to Implement)
- Bubble Details screen
- Chat screen with CometChat UI components
- Create Bubble flow (3-step form)
- Image upload for bubble covers
- Profile screen
- Upcoming events screen
- Push notifications

## Troubleshooting

### "Network request failed"
**Problem**: Mobile app can't reach the backend

**Solution**:
1. Check that your Replit backend is running
2. Verify `EXPO_PUBLIC_API_URL` in `.env` is correct
3. Make sure the URL starts with `https://`

### CometChat initialization errors
**Problem**: CometChat won't initialize

**Solution**:
1. Verify credentials in `.env` match your CometChat dashboard
2. Check that `COMETCHAT_REGION` is correct (us, eu, or in)
3. Ensure your CometChat app is active

### Build errors after installing dependencies
**Problem**: TypeScript or build errors

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
expo start -c
```

### Can't connect on Android
**Problem**: Android device can't connect to dev server

**Solution**:
1. Ensure phone and computer are on **same WiFi network**
2. Try running: `expo start --tunnel` (uses ngrok)

## Development Tips

### Hot Reload
- Code changes reload automatically
- Shake device (or Cmd+D iOS / Cmd+M Android) for dev menu

### Debugging
- Use React Native Debugger
- Or Chrome DevTools (in Expo dev menu, select "Debug Remote JS")
- Console.log statements appear in terminal

### Testing on Multiple Devices
You can test simultaneously on multiple devices by scanning the same QR code

## Backend API Endpoints

Your backend exposes these endpoints:

```
POST   /api/auth/signup          # Create account
POST   /api/auth/login           # Login
GET    /api/bubbles              # List all bubbles
GET    /api/bubbles/my           # My joined bubbles (requires auth)
GET    /api/bubbles/:id          # Bubble details
POST   /api/bubbles              # Create bubble (requires auth)
POST   /api/bubbles/:id/join     # Join bubble (requires auth)
POST   /api/bubbles/:id/leave    # Leave bubble (requires auth)
GET    /api/bubbles/:id/members  # Get members
```

## CometChat Integration

The app is set up to:
1. Initialize CometChat on app launch
2. Login user to CometChat after successful auth
3. Create group for each bubble
4. Auto-join CometChat group when joining bubble
5. Real-time messaging in group chats

### CometChat Resources
- [Dashboard](https://www.cometchat.com/dashboard)
- [React Native SDK Docs](https://www.cometchat.com/docs/react-native-chat-sdk/overview)
- [UI Components](https://www.cometchat.com/docs/react-native-ui-kit/overview)

## Next Development Steps

1. **Implement Bubble Details**:
   - Create `BubbleDetailsScreen.tsx`
   - Add to navigation stack
   - Show members, description, rules

2. **Build Chat Screen**:
   - Install CometChat UI Kit: `@cometchat/chat-uikit-react-native`
   - Create chat screen with message list
   - Add composer for sending messages

3. **Create Bubble Flow**:
   - 3-step form (Details, Privacy, Preview)
   - Image picker for cover photo
   - Submit to backend API
   - Create CometChat group

4. **Polish & Deploy**:
   - Add loading states
   - Error handling
   - Offline support
   - Build for TestFlight (iOS) or Play Store (Android)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [NativeWind (Tailwind for RN)](https://www.nativewind.dev/)
- [TanStack Query](https://tanstack.com/query/latest)

## Need Help?

Common issues and solutions are in the Troubleshooting section above. For React Native specific questions, check the [Expo documentation](https://docs.expo.dev/) or [React Native docs](https://reactnative.dev/).

---

**You're all set!** The mobile app structure is ready, and you can start developing locally. The backend is running on Replit and ready to handle API requests. 🚀
