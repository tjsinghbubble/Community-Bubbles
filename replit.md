# Bubble - Local Community Building Platform

## Overview

Bubble is a social platform for building local communities through interest-based groups ("Bubbles"). The application consists of four main components:

1. **Web Client** - React SPA with Vite (legacy prototype, reference only)
2. **Backend Server** - Express.js API with PostgreSQL database for authentication, bubbles, and memberships
3. **Mobile App** - React Native/Expo app (PRIMARY APPLICATION - designed for iOS/Android local development)
4. **Analytics Dashboard** - React app for viewing user metrics (local development only, see app/ folder)

The platform enables users to create and join interest-based communities through a mobile-first experience. Users sign up, select interests, explore bubbles, join communities, and communicate through integrated real-time messaging powered by CometChat.

**Current Status**: Mobile app structure complete with auth flow, navigation, and backend API. Backend running on Replit. Mobile app requires local development setup (see MOBILE_SETUP.md).

## User Preferences

Preferred communication style: Simple, everyday language.

## Design System

All UI development MUST reference the design system at `mobile/src/styles/theme.ts`. This file contains every color, button variant, input style, selection control, icon state, gradient, and spacing token used across the app.

**Key imports for any screen:**
```typescript
import { Colors, Spacing, Radius, Typography, ButtonStyles, ButtonTextStyles, InputStyles, Gradients } from '../styles/theme';
```

**Core Brand Colors:**
- Bubble Blue `#35A8F7` — primary actions, links, active states
- Midnight `#1E1F26` — nav bars, modals, dark backgrounds
- Sky White `#FFFFFF` — cards, surfaces
- Background `#FAFAFA` — screen backgrounds

**Button Variants:** primaryGradient (Gradient 2), secondary (solid blue), disabled (grey), outline (blue border), light (light blue fill), ghost (grey border), destructive (red border)

**Gradient 2** (used on primary buttons): `#A8D8F7` → `#35A8F7` (requires `expo-linear-gradient` or equivalent)

**States:** Success Green `#34C759`, Alert Red `#FF3B30`, Carrot `#F9888C`

**Neutrals:** Cloud Grey `#F5F6F8`, Cool Mist `#969696`, Charcoal `#4D4D4D` (primary text)

**Icon colors:** default=Charcoal, active=Bubble Blue, inactive=Cool Mist, error=Alert Red

**IMPORTANT:** When building or editing any UI, always use theme tokens instead of hardcoded hex values. This ensures brand consistency across all screens.

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
- **bubbles**: id, title, tagline, category, description, rules, privacy, cover image, images array (multi-image support), member count, creator reference, campusId (optional - for campus-only bubbles)
- **memberships**: Join table linking users to bubbles with role ('member' or 'admin') and timestamps
- **events**: id, title, description, date, time, location, cover image, images array (multi-image support), bubble reference, creator reference, campusId (optional - for campus-only events)
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
- Create Bubble is a 5-step wizard: Pick Category → Bubble Details (title, tagline, description, location, radius, cover photo, attachments) → Rules (add/edit/delete) → Privacy & Settings (Public/Request/Private, member limit) → Review & Submit
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
- Profile tab shows "Admin" label with shield icon for super admins

**Content Approval Workflow**:
- All new bubbles and events default to "pending" status and are not visible to regular users
- Any logged-in user can create/propose bubbles and events for approval
- Only super admins can approve/reject bubbles and events
- Super admins manage pending content via PendingReviewsScreen accessible from Profile/Admin tab
- Optional rejection reason can be provided when rejecting content
- Creators see "Under Review" badge on their pending content in MyBubblesScreen
- Rejected content shows "Rejected" badge to creators
- When a bubble is approved, its creator is automatically made an admin member of that bubble

**Content Status Field**:
- `status`: 'pending' | 'approved' | 'rejected' (default: 'pending')
- `rejectionReason`: Optional text explaining why content was rejected

**Bubble Management**:
- Bubble creators and super admins see an options button (ellipsis icon) in BubbleDetailsScreen header
- Options menu provides Edit and Delete actions
- Delete confirmation includes warning about cascading deletion of events
- EditBubbleScreen allows modifying bubble details while preserving campus association

**Authorization Model**:
- Bubble/Event creation: Any logged-in user (content starts in pending status)
- Bubble edit/delete: Creator OR super admin
- Bubble approve/reject: Super admin only
- Event edit/delete: Event creator OR bubble admin (creator) OR super admin
- Event approve/reject: Super admin only
- All admin operations are verified server-side before mutations

**Admin API Endpoints**:
- `GET /api/admin/pending-bubbles` - Get all pending bubbles (super admin only)
- `GET /api/admin/pending-events` - Get all pending events (super admin only)
- `POST /api/admin/bubbles/:id/approve` - Approve a bubble (super admin only)
- `POST /api/admin/bubbles/:id/reject` - Reject a bubble with optional reason (super admin only)
- `POST /api/admin/events/:id/approve` - Approve an event (super admin only)
- `POST /api/admin/events/:id/reject` - Reject an event with optional reason (super admin only)

**Campus API Endpoints**:
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

### Multi-Image Upload Feature

Bubbles and events support multiple image uploads using Replit App Storage:

**Upload Flow**:
1. User selects images via MultiImagePicker component (up to 5 images per bubble/event)
2. Mobile app requests presigned URL from `/api/uploads/request-url` (requires auth)
3. Image is uploaded directly to Google Cloud Storage via presigned URL
4. Image URL is stored in the images array and first image becomes coverImage

**Components**:
- `mobile/src/components/MultiImagePicker.tsx` - Image picker with upload functionality
- `mobile/src/components/ImageCarousel.tsx` - Swipeable carousel for viewing images
- `server/replit_integrations/object_storage/` - Object storage routes and services

**API Endpoints**:
- `POST /api/uploads/request-url` - Get presigned URL for upload (auth required)
- `GET /objects/uploads/:objectId` - Serve uploaded images

### Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing (defaults to development value)
- `COMETCHAT_APP_ID` - CometChat application ID
- `COMETCHAT_REGION` - CometChat region (default: "us")
- `COMETCHAT_AUTH_KEY` - CometChat authentication key
- `EXPO_PUBLIC_API_URL` - Backend URL for mobile app
- `PRIVATE_OBJECT_DIR` - Private object storage directory (auto-configured)
- `PUBLIC_OBJECT_SEARCH_PATHS` - Public object storage search paths (auto-configured)