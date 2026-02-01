# Bubble - Local Community Building Platform

## Overview

Bubble is a social platform for building local communities through interest-based groups ("Bubbles"). The application consists of three main components:

1. **Web Client** - React SPA with Vite (legacy prototype, reference only)
2. **Backend Server** - Express.js API with PostgreSQL database for authentication, bubbles, and memberships
3. **Mobile App** - React Native/Expo app (PRIMARY APPLICATION - designed for iOS/Android local development)

The platform enables users to create and join interest-based communities through a mobile-first experience. Users sign up, select interests, explore bubbles, join communities, and communicate through integrated real-time messaging powered by CometChat.

**Current Status**: Mobile app structure complete with auth flow, navigation, and backend API. Backend running on Replit. Mobile app requires local development setup (see MOBILE_SETUP.md).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture (Web)

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite with custom plugins for meta images and Replit integration
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Animations**: Framer Motion for transitions and micro-interactions
- **UI Components**: Radix UI primitives wrapped with shadcn/ui styling

**Key Design Decisions**:
- Component-based architecture with pages in `client/src/pages/`
- Shared UI components in `client/src/components/ui/`
- Path aliases configured: `@/` for client source, `@shared/` for shared code

### Backend Architecture

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with bcrypt password hashing
- **API Style**: RESTful JSON endpoints under `/api/`

**Key Design Decisions**:
- Schema definitions shared between frontend and backend in `shared/schema.ts`
- Database storage abstracted through `IStorage` interface in `server/storage.ts`
- Vite dev server integrated for development with HMR support
- Production builds use esbuild with strategic dependency bundling

### Database Schema

Core tables managed by Drizzle ORM:
- **users**: id, name, email, password (hashed), interests array, campusId, campusEmail, campusVerified, dismissedCampusPrompt, isSuperAdmin (boolean), timestamps
- **campuses**: id, domain (.edu), title (university name) - seeded with 50 US universities
- **bubbles**: id, title, tagline, category, description, rules, privacy, cover image, member count, creator reference, campusId (optional - for campus-only bubbles)
- **memberships**: Join table linking users to bubbles with role ('member' or 'admin') and timestamps
- **events**: id, title, description, date, time, location, bubble reference, creator reference, campusId (optional - for campus-only events)
- **event_attendees**: Join table for event RSVPs with status
- **verification_codes**: Stores 6-digit codes for email verification (campus and signup)

### Mobile Architecture

- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation (native stack + bottom tabs)
- **Styling**: NativeWind (Tailwind for React Native)
- **State**: TanStack React Query (shared patterns with web)
- **Messaging**: CometChat SDK for real-time chat

**Key Design Decisions**:
- Separate package in `/mobile` directory with its own dependencies
- Designed to connect to the same backend API
- Authentication flow mirrors web with signup → interests → guidelines progression
- When creating a bubble, a CometChat group is automatically created for real-time messaging
- ExploreScreen fetches real bubbles from API (refreshes on focus for newly created bubbles)
- BubblesNavigator stack wraps MyBubbles list and CreateBubble screens
- Uses react-native-safe-area-context for consistent safe area handling across all screens

### Campus Mode Feature

Campus Mode allows college students to verify their .edu email addresses and access exclusive campus-specific bubbles and events:

**Verification Flow**:
1. User sees "Are you a student?" prompt card on ExploreScreen (dismissible, only shows in public view)
2. User navigates to CampusJoinScreen → enters .edu email
3. System sends 6-digit verification code (shown in Alert during dev mode)
4. User enters code on CampusVerifyScreen → campus association saved
5. Verified users see floating action button (FAB) with graduation cap icon (🎓) on ExploreScreen

**Campus Content Toggle (FAB)**:
- Verified users can toggle between public content and campus content using the FAB
- FAB shows white background when inactive, blue when active
- When active, a campus banner shows the university name
- Student prompt card is hidden when viewing campus content

**Creating Campus-Only Content**:
- CreateBubbleScreen: Verified users see "Campus Only" toggle to restrict bubble to their campus
- CreateEventScreen: If selected bubble has campusId, event inherits campus restriction (info banner shown). Otherwise, verified users can toggle "Campus Only" for public bubbles

**Privacy Model**:
- Campus bubbles/events are private - only visible to verified users of that campus
- Public content filtered to exclude campus-only items (campusId is null for public)
- Users can dismiss the student prompt ("I'm not a student") which persists to their record
- Server enforces campus authorization on all related endpoints (details, members, events, RSVP, join)

### Admin Features

**Super Admins**:
- Super admin status is set via the `isSuperAdmin` boolean field in the users table (manually set via database)
- Super admins can edit and delete any bubble regardless of creator status
- isSuperAdmin is returned in login and /auth/me responses for client-side authorization checks

**Bubble Management**:
- Bubble creators and super admins see an options button (ellipsis icon) in BubbleDetailsScreen header
- Options menu provides Edit and Delete actions
- Delete confirmation includes warning about cascading deletion of events
- EditBubbleScreen allows modifying bubble details while preserving campus association

**Authorization Model**:
- Bubble edit/delete: Creator OR super admin
- Event edit/delete: Event creator OR bubble admin (creator) OR super admin
- All admin operations are verified server-side before mutations

**API Endpoints**:
- `POST /api/campus/send-verification` - Send verification code to .edu email
- `POST /api/campus/verify-code` - Verify code and associate user with campus
- `POST /api/campus/dismiss-prompt` - Dismiss the student prompt
- `GET /api/campus/bubbles` - Get campus-specific bubbles (requires verification)
- `GET /api/campus/events` - Get campus-specific events (requires verification)
- `GET /api/campus/my-campus` - Get user's campus info

## External Dependencies

### Third-Party Services

- **CometChat**: Real-time messaging SDK for direct and group chat functionality. Requires `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, and `COMETCHAT_AUTH_KEY` environment variables
- **Google Places API**: Location autocomplete for event creation. Requires `GOOGLE_PLACES_API_KEY` (server) and `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` (mobile) environment variables
- **Google Fonts**: DM Sans and Outfit font families loaded via CDN

### Database

- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database operations with schema synchronization via `drizzle-kit push`

### Key NPM Dependencies

**Backend**:
- `express` - HTTP server
- `drizzle-orm` + `pg` - Database operations
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication

**Frontend**:
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Accessible UI primitives
- `framer-motion` - Animations
- `wouter` - Client-side routing
- `date-fns` - Date formatting

**Mobile**:
- `expo` - Development platform
- `@react-navigation/*` - Navigation
- `@cometchat/chat-sdk-react-native` - Messaging
- `nativewind` - Tailwind styling

### Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing (defaults to development value)
- `COMETCHAT_APP_ID` - CometChat application ID
- `COMETCHAT_REGION` - CometChat region (default: "us")
- `COMETCHAT_AUTH_KEY` - CometChat authentication key
- `EXPO_PUBLIC_API_URL` - Backend URL for mobile app