# Bubble - Quick Start Guide

## What You Have Now

Your Bubble mobile app is ready to develop locally! Here's what's set up:

### ✅ Backend (Running on Replit)
- PostgreSQL database with users, bubbles, and memberships
- Complete REST API with JWT authentication
- All API endpoints tested and working
- CometChat credentials configured

### ✅ Mobile App (Ready for Local Development)
- React Native + Expo project structure
- Complete authentication flow (Signup → Interests → Guidelines)
- Bottom tab navigation
- API service configured
- CometChat SDK integrated

## Quick Start (3 Steps)

### 1. Get Your Backend URL

Your backend is running on Replit at:
```
https://[your-replit-url].replit.dev
```

Copy this URL - you'll need it for the mobile app.

### 2. Set Up Mobile App Locally

On your local machine:

```bash
# Download the /mobile folder from this Replit
# Navigate to it
cd mobile

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
EXPO_PUBLIC_API_URL=https://[your-replit-url].replit.dev
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key
EOF

# Start the app
npm start
```

### 3. Run on Your Phone

**Easiest way**:
1. Install Expo Go app ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
2. Scan the QR code from your terminal
3. App opens on your phone!

## What Works Right Now

### Authentication Flow
1. **Signup Screen** - Create account with name, email, password
2. **Interests Screen** - Select at least 3 interests
3. **Guidelines Screen** - Accept community rules
4. Auto-login after signup

### Main App (Bottom Tabs)
- **Explore** - Browse all available bubbles
- **My Bubbles** - See bubbles you've joined
- **Messages** - Chat interface (placeholder)
- **Upcoming** - Events calendar (placeholder)
- **Profile** - User profile (placeholder)

### Backend API Endpoints

All working and tested:

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

## What to Build Next

### Priority 1: Bubble Details & Chat
1. **Bubble Details Screen**
   - Show full description, rules, members
   - Join/leave button
   - Navigate to chat

2. **Chat Screen**
   - Use CometChat UI components
   - Real-time messaging
   - Group chat for each bubble

### Priority 2: Create Bubble Flow
1. **Create Bubble Form**
   - 3 steps: Details → Privacy → Preview
   - Image picker for cover photo
   - Category selection

2. **Backend Integration**
   - Submit to API
   - Create CometChat group automatically
   - Auto-join creator

### Priority 3: Polish & Features
- Profile screen with user info
- Edit profile
- Search bubbles
- Filter by category
- Push notifications
- Upcoming events screen

## File Structure

```
/mobile
├── src/
│   ├── navigation/              # App navigation
│   │   ├── RootNavigator.tsx    # Main router
│   │   ├── AuthNavigator.tsx    # Auth flow
│   │   └── MainNavigator.tsx    # Bottom tabs
│   ├── screens/
│   │   ├── auth/                # Login, signup, interests
│   │   └── main/                # Explore, bubbles, messages
│   ├── services/
│   │   ├── api.service.ts       # Backend API client
│   │   └── cometchat.service.ts # CometChat wrapper
│   └── types/                   # TypeScript types
├── App.tsx                      # Root component
├── package.json
└── .env                         # Your config (create this)

/server                          # Backend (on Replit)
├── routes.ts                    # API endpoints
├── storage.ts                   # Database layer
└── db.ts                        # Database connection

/shared
└── schema.ts                    # Shared types & DB schema
```

## Tips for Development

### Hot Reload
Changes you make in code will reload automatically on your device!

### Debugging
- Shake your device (or press Cmd+D on iOS / Cmd+M on Android)
- Select "Debug Remote JS"
- Open Chrome DevTools
- Console.log appears in terminal

### Testing Backend
The backend runs on Replit. You can test endpoints directly:

```bash
# List bubbles
curl https://[your-url].replit.dev/api/bubbles

# Create user
curl -X POST https://[your-url].replit.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123","interests":[]}'
```

### CometChat Setup
1. Go to [CometChat Dashboard](https://www.cometchat.com/dashboard)
2. Create an app (or use existing)
3. Get your App ID, Region, and Auth Key
4. Add to mobile `.env` file

## Common Issues

### "Network request failed"
- Backend isn't running on Replit
- Wrong URL in `EXPO_PUBLIC_API_URL`
- URL doesn't start with `https://`

### CometChat won't initialize
- Wrong credentials in `.env`
- CometChat app isn't active
- Check region (us/eu/in)

### Can't scan QR code
- Make sure phone and computer are on same WiFi
- Try `npm start --tunnel` (uses ngrok)

## Resources

- [Full Setup Guide](./mobile/README.md) - Detailed instructions
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [CometChat React Native](https://www.cometchat.com/docs/react-native-chat-sdk/overview)

## Need More Help?

Check out:
1. `MOBILE_SETUP.md` - Comprehensive setup guide
2. `mobile/README.md` - Mobile app documentation
3. `replit.md` - Project architecture overview

---

**You're all set!** The foundation is ready. Now you can build the features that make Bubble unique. 🚀
