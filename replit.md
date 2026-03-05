# Bubble - Local Community Building Platform

## Overview

Bubble is a social platform designed to foster local communities through interest-based groups called "Bubbles." It primarily offers a mobile-first experience where users can sign up, define interests, discover and join bubbles, and communicate in real-time. The platform aims to connect individuals with shared interests within their local vicinity, potentially expanding to integrate with academic institutions.

The project is structured around a mobile application (React Native/Expo), a backend server (Express.js with PostgreSQL), and a legacy web client (React SPA for reference). A key feature is "Campus Mode," allowing university students to access exclusive campus-specific content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The application adheres to a strict design system defined in `mobile/src/styles/theme.ts`, ensuring consistent branding and user experience across all UI components. Core brand colors include Bubble Blue (`#35A8F7`), Midnight (`#1E1F26`), Sky White (`#FFFFFF`), and Background (`#FAFAFA`). A variety of button variants and states are pre-defined, with a strong emphasis on using theme tokens rather than hardcoded values for all UI elements.

### Technical Implementations

The project comprises a monorepo structure with distinct frontend (web and mobile) and backend components.

**Web Frontend (Legacy)**:
- **Framework**: React 19 with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4, shadcn/ui (New York style)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Animations**: Framer Motion
- **UI Components**: Radix UI primitives

**Backend Server**:
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with bcrypt
- **API Style**: RESTful JSON endpoints

**Mobile App (Primary Focus)**:
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation (native stack + bottom tabs)
- **Styling**: NativeWind (Tailwind for React Native)
- **State**: TanStack React Query
- **Messaging**: CometChat SDK
- **Design Decisions**: Separate package, connects to the same backend API, features a multi-step "Create Bubble" wizard and robust authentication flow. Uses `react-native-safe-area-context` for UI consistency.
- **BubbleButton**: Reusable button component at `mobile/src/components/BubbleButton.tsx`. Uses SVG backgrounds from `assets/icons/Buttons/` via `react-native-svg`. Variants: `primary` (gradient blue), `outline` (blue border), `destructive` (red border), `ghost` (muted border). Supports `disabled`, `loading`, `icon`, `testID` props. Used across all auth and main screens.
- **Design Tokens**: SVG-derived dimensions and colors are exported from `mobile/src/styles/design-tokens.ts` and imported by screens/components. Human-readable spec mapping lives in `mobile/src/assets/DESIGN_SPECS.md`. Both files are Git-tracked and portable.

### Feature Specifications

**Database Schema**: Core entities include `users`, `campuses`, `bubbles`, `memberships`, `events`, `event_attendees`, `verification_codes`, and `categories`, managed by Drizzle ORM.

**Categories**: Hierarchical category system with parent-child relationships. The `categories` table has `id` (serial PK), `name`, `displayName`, `icon`, `image`, and `parentId` (nullable integer, null = top-level). 8 parent categories (Active, Creative, Food & Social, Lifestyle, Adventure & Outdoors, Community, Professional, Campus) with 39 subcategories total. Categories are seeded on startup from `server/seed-categories.ts`. The Create Bubble flow shows only subcategories as selectable chips grouped under parent headings. The `bubbles.category` field stores the subcategory displayName as text. API endpoints: GET `/api/categories` (nested tree), GET `/api/categories/flat`, POST/PUT/DELETE `/api/categories/:id` (super admin only).

**Campus Mode**: Allows verified university students to access campus-exclusive bubbles and events. Features include a verification flow via .edu emails, a toggle for campus-specific content, and options to create campus-only bubbles/events. Campus content is private and restricted to verified users of that institution.

**Bubble Privacy Model**: Implements a three-tier privacy system:
- **Public**: Visible in Explore, instant join.
- **Request to Join**: Visible in Explore, requires admin approval.
- **Private**: Hidden from Explore, accessible via direct link, requires admin approval.
Membership statuses (`approved`, `pending`) control access and actions.

**Admin Features**:
- **System Admin**: A dedicated super admin account (`sysadmin@seinfeld.com`) with platform-wide management capabilities.
- **Super Admins**: Users with `isSuperAdmin=true` can edit/delete any content and approve/reject bubbles/events.
- **Content Approval Workflow**: Bubbles default to 'pending' and require super admin approval. Events are approved immediately but have an underlying approval infrastructure. Super admins manage pending content and can provide rejection reasons.
- **Authorization Model**: Granular permissions for content creation, editing, deletion, and approval are enforced server-side.

**Multi-Image Upload**: Supports uploading up to 5 images for bubbles and events via presigned URLs to Google Cloud Storage.

**Timezone Handling**: Events are stored in UTC in the database. Each event has a `timezone` column (IANA format, e.g. "America/Chicago") defaulting to 'UTC'. On create/update, the server converts local times to UTC using `server/timezone.ts`. On GET, the server converts UTC back to the event's local timezone before sending to clients. Mobile clients send `Intl.DateTimeFormat().resolvedOptions().timeZone` with event creation. The reminder scheduler compares UTC times directly.

## External Dependencies

### Third-Party Services

-   **CometChat**: Real-time messaging SDK for chat functionality.
-   **Google Places API**: Used for location autocomplete during event creation.
-   **Google Fonts**: DM Sans and Outfit font families are integrated.

### Database

-   **PostgreSQL**: The primary relational database.
-   **Drizzle ORM**: Used for type-safe database interactions.

### Key NPM Dependencies

**Backend**: `express`, `drizzle-orm`, `pg`, `bcrypt`, `jsonwebtoken`.
**Frontend (Web)**: `@tanstack/react-query`, `@radix-ui/*`, `framer-motion`, `wouter`, `date-fns`.
**Mobile**: `expo`, `@react-navigation/*`, `@cometchat/chat-sdk-react-native`, `nativewind`.