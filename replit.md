# Bubble - Local Community Building Platform

## Overview

Bubble is a mobile-first social platform designed to connect individuals within their local communities through shared interests, organized into "Bubbles." It enables users to discover, join, and communicate within these groups, with features like real-time messaging, event management, and interest-based matching. The platform aims to foster strong local connections and has future potential for integration with academic institutions through a "Campus Mode."

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

**Slow API Call Alerts**: Any API call exceeding 2s is persisted to the `slow_calls` database table (endpoint, method, durationMs, createdAt). A new admin screen at `/admin/slow-calls` displays the log, sortable by duration, endpoint, or timestamp, with a 30-day auto-purge. The "Performance Alerts" section in the Admin Monitor links to both this page and the in-memory Latency Dashboard.

**Crash Report Persistence**: Mobile crash reports submitted to `POST /api/crash-report` are now persisted to the `crash_reports` database table (message, stack, context, platform, appVersion, isFatal, userId, username, createdAt). An admin-only `GET /api/crash-reports` endpoint allows filtering by userId, isFatal, and date range (from/to), with pagination (limit/offset, max 500). Records are automatically pruned after a configurable retention window (default 90 days, overridable via `CRASH_REPORT_RETENTION_DAYS` env var). Indices exist on userId, createdAt, and isFatal for efficient lookups.

**Bubble Sharing System**: Each bubble has a unique 6-character Base62 `shortId` (stored in `bubbles.short_id`). Short IDs are auto-generated on bubble creation and backfilled for existing bubbles on startup. Resolution endpoint `GET /b/:shortId` returns bubble data. The share URL format is `{SHARE_BASE_URL}/b/{shortId}`, where `SHARE_BASE_URL` is a configurable env var (defaults to `https://mybubble.trybubble.io`). The config endpoint `GET /api/config/share-base-url` returns the current base URL. The shortId generator lives in `server/shortId.ts`. Features include: QR code generation (`ShareQRCodeModal` component using `react-native-qrcode-svg`), native share sheet integration, and deep linking via `expo-linking` (URL scheme `bubble://`, universal link prefix from `SHARE_BASE_URL`). Deep links resolve shortIds and navigate to `BubbleDetails` screen.

**Hierarchical Rules System**: Rules are managed through a three-level hierarchy: app-level, category-level, and bubble-level. Tables: `rules` (serial PK, text), `app_rules` (links rule to app, with position), `category_rules` (links rule to category, with position), `bubble_rules` (links rule to bubble, with position), `bubble_rule_overrides` (allows bubble admins to hide inherited rules). 8 app-level rules seeded on startup via `server/seed-rules.ts`. The effective rules endpoint `GET /api/rules/effective/:bubbleId` returns all applicable rules (app + category + bubble) with override visibility. Bubble admins can add/edit/delete bubble-level rules and override inherited rules. Super admins can manage app and category rules. The legacy `bubbles.rules text[]` column is preserved for backward compatibility. Mobile screens (WelcomeBubbleModal, JoinBubbleScreen, CreateBubbleScreen, EditBubbleScreen) fetch rules from the API.

**Multi-Image Upload**: Supports uploading up to 5 images for bubbles and events via presigned URLs to Google Cloud Storage.

**Timezone Handling**: Events are stored in UTC with IANA timezone information, with server-side conversion for display and reminders.

## External Dependencies

### Third-Party Services

-   **CometChat**: Real-time messaging.
-   **Google Places API**: Location autocomplete.
-   **Google Fonts**: DM Sans and Outfit.

### Secrets Management

**Never hard-code API keys, tokens, or URLs in source, and never commit them.**
All such values are read from environment variables only. Full guide:
`docs/SECRETS_MANAGEMENT.md`.

-   **Client values are PUBLIC.** Anything prefixed `EXPO_PUBLIC_` (mobile) or
    `VITE_` (web) is inlined into the shipped bundle and is readable from the
    binary and network traffic. Never put a true secret behind those prefixes.
-   **Required client vars:** `EXPO_PUBLIC_API_URL`,
    `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, `EXPO_PUBLIC_COMETCHAT_APP_ID`. Code reads
    them via `requireEnv()`; the build is gated by `mobile/scripts/check-secrets.sh`,
    so a missing required var fails the build (it will not silently fall back).
-   **True secrets are server-side only:** DB credentials, `JWT_SECRET`,
    `ENCRYPTION_KEY`, any CometChat REST/auth key, and any privileged or billable
    API key. These must never reach client code.
-   **On Replit:** set sensitive values in Tools → Secrets. The `.replit [env]`
    block is committed — use it only for non-secret identifiers, never real keys.
-   When adding a service, follow this model; do not reintroduce hard-coded
    fallbacks "to make it work."

### Database

-   **PostgreSQL**: Primary relational database.
-   **Drizzle ORM**: Type-safe database interactions.
