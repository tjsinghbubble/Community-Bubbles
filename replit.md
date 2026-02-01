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
- **users**: id, name, email, password (hashed), interests array, timestamps
- **bubbles**: id, title, tagline, category, description, rules, privacy, cover image, member count, creator reference
- **memberships**: Join table linking users to bubbles with role ('member' or 'admin') and timestamps
- **events**: id, title, description, date, time, location, bubble reference, creator reference
- **event_attendees**: Join table for event RSVPs with status

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