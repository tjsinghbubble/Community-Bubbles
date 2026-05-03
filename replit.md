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

**Audit Trail System** (fully complete — Batches 1-3): Every mutable table now carries `created_at`, `created_by`, `updated_at`, and `updated_by` columns where appropriate, with `BEFORE UPDATE` triggers auto-maintaining `updated_at`. All audit columns are populated by storage methods and route handlers. Migration files `0009`–`0011` plus idempotent blocks in `server/auto-migrate.ts` keep dev and production in sync.

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

**Password Reset Flow**: Forgot password sends a 6-digit code via email (`POST /api/auth/forgot-password`); `POST /api/auth/reset-password` verifies the code and updates the password. Two new auth screens: `ForgotPasswordScreen` and `ResetPasswordScreen`.

**Account Confirmation (Data Download/Delete)**: `DataConfirmAccountScreen` now sends a real verification code to the logged-in user's email on mount via `POST /api/auth/send-account-verification` (auth-required), and verifies via the existing `POST /api/auth/verify-code`. Removed hardcoded `122333` code.

**Campus Email Verification**: `CampusVerifyScreen` resend flow no longer shows devCode in an alert — it uses the fallbackCode path only when email delivery fails.

**User Feedback System**: `POST /api/feedback` (auth-required) stores typed submissions (`feedback` | `feature` | `defect` | `help`) to the `feedback` DB table. Four entry points in the app: Give Feedback, Get Help, Feature Request, and Defect Report — all accessible from the Profile > Get Help menu. A single `FeedbackFormScreen` handles the latter three via route params.

**Crash Report Persistence**: Mobile crash reports submitted to `POST /api/crash-report` are now persisted to the `crash_reports` database table (message, stack, context, platform, appVersion, isFatal, userId, username, createdAt). An admin-only `GET /api/crash-reports` endpoint allows filtering by userId, isFatal, and date range (from/to), with pagination (limit/offset, max 500). Records are automatically pruned after a configurable retention window (default 90 days, overridable via `CRASH_REPORT_RETENTION_DAYS` env var). Indices exist on userId, createdAt, and isFatal for efficient lookups.

**Database Indexes — Batch 1 (Critical paths)**: Nine production indexes added via `migrations/0012_indexes_batch1.sql` and idempotent `auto-migrate.ts` block. Covers: `users.email_lower` (unique partial index for case-insensitive login uniqueness + new `email_lower` TEXT column backfilled on all users), `users.email` (supporting index), `memberships(user_id, bubble_id)` (unique composite — prevents duplicate memberships), `events(bubble_id)`, `events(bubble_id, start_time DESC)`, `events(created_at DESC)`, `event_attendees(event_id, user_id)` (unique composite — prevents duplicate RSVPs), `notifications(recipient_id, created_at DESC)` (inbox queries), `bubble_visits(user_id, bubble_id)`. Drizzle schema (`shared/schema.ts`) declares all indexes via `index()`/`uniqueIndex()` API. `createUser` in `server/storage.ts` now populates `email_lower` on every new registration.

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