# Bubble - Local Community Building Platform

## Overview

Bubble is a mobile-first social platform designed to connect individuals within their local communities through shared interests, organized into "Bubbles." It enables users to discover, join, and communicate within these groups, with features like real-time messaging, event management, and interest-based matching. The platform aims to foster strong local connections and has future potential for integration with academic institutions through a "Campus Mode."

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The application utilizes a consistent design system defined in `mobile/src/styles/theme.ts`, employing core brand colors like Bubble Blue, Midnight, Sky White, and Background. UI components, including various button types, are built using theme tokens to ensure uniformity. The mobile profile page features an Airbnb-inspired tile/card layout with soft drop shadows and a `borderRadius: 20` for cards.

### Technical Implementations

The project is a monorepo containing distinct frontend and backend components.

**Web Frontend (Legacy)**:
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State Management**: TanStack React Query

**Backend Server**:
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based

**Mobile App (Primary Focus)**:
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation
- **Styling**: NativeWind (Tailwind for React Native)
- **State**: TanStack React Query
- **Messaging**: CometChat SDK
- **Components**: Reusable `BubbleButton` component and SVG-derived design tokens for consistent styling.
- **Utilities**: Centralized photo/camera permission handling with pre-prompts and settings guidance.

### Feature Specifications

**Database Schema**: Core entities include `users`, `campuses`, `bubbles`, `memberships`, `events`, `categories`, and `app_config`.

**App Config**: Runtime-configurable key-value pairs stored in the `app_config` table, allowing dynamic updates without code redeployment.

**Health Check API**: Three-tier public monitoring endpoints (`/ping`, `/status`, `/health`) for server and database health, with maintenance mode integration.

**Categories**: A hierarchical category system with parent-child relationships for organizing bubbles, seeded on startup.

**Campus Mode**: Provides exclusive content and features for verified university students, including a `.edu` email verification flow.

**Bubble Privacy Model**: Three-tiered system: Public, Request to Join, and Private, controlling visibility and membership approval.

**Join Bubble & Welcome Bubble Modals**: Streamlined user flow for joining bubbles, including displaying bubble details, rules acceptance, and post-join suggestions.

**Admin Features**: Includes a dedicated super admin account, granular authorization for content management (bubbles, events, categories, rules), and web-based admin pages for monitoring and content approval workflows.

**Bubble Sharing System**: Each bubble has a unique 6-character Base62 `shortId` for shareable URLs, QR code generation, and deep linking.

**Event Sign-Up Sheet**: An Evite-style task sign-up feature for event attendees, allowing event creators/admins to define tasks and members to volunteer.

**Hierarchical Rules System**: Manages app-level, category-level, and bubble-level rules, with support for overrides and an effective rules API endpoint.

**Multi-Image Upload**: Supports uploading up to 5 images for bubbles and events via presigned URLs to Google Cloud Storage.

**Timezone Handling**: Events are stored in UTC with IANA timezone information, with server-side conversion for display and reminders.

## External Dependencies

### Third-Party Services

-   **CometChat**: Real-time messaging.
-   **Google Places API**: Location autocomplete.
-   **Google Fonts**: DM Sans and Outfit.

### Database

-   **PostgreSQL**: Primary relational database.
-   **Drizzle ORM**: Type-safe database interactions.