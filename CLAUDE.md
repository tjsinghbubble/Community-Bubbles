# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend + Web (root directory)
```bash
npm run dev          # Start Express server (port 5000, serves API + web client via Vite)
npm run build        # Production build
npm run check        # TypeScript type-check
npm run db:push      # Apply schema changes to the database (Drizzle push)
```

### Mobile (mobile/ directory)
```bash
cd mobile && npm install   # Install mobile dependencies separately
cd mobile && npm start     # Start Expo dev server
# Then press i (iOS), a (Android), or scan QR with Expo Go
expo start -c              # Clear cache if needed
```

There are no automated tests in this codebase.

## Environment Variables

**Root `.env`** (required for server):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — token signing secret
- `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY` — CometChat credentials

**`mobile/.env`** (required for mobile):
- `EXPO_PUBLIC_API_URL` — must be your machine's LAN IP (not `localhost`) so the physical device can reach the server, e.g. `http://192.168.1.x:5000`
- `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`

## Architecture

This is a monorepo with four distinct surfaces sharing one PostgreSQL database:

```
server/      Express 5 REST API (TypeScript, runs on port 5000)
client/      React 19 web app (Vite, served by the Express server in dev via proxy)
mobile/      React Native + Expo 54 mobile app (separate npm workspace)
app/         Standalone analytics dashboard (separate React + Vite app)
shared/      PostgreSQL schema (Drizzle ORM) + Zod-inferred TypeScript types
```

The root `package.json` contains all server + web client dependencies. The `mobile/` directory has its own `package.json` and `node_modules`.

### Data Flow

All database access goes through a single interface in `server/storage.ts`. The `IStorage` interface is implemented by the `Storage` class, which uses Drizzle ORM queries against the schema defined in `shared/schema.ts`. Routes in `server/routes.ts` call `storage.*` methods — **never query the DB directly from routes**.

```
shared/schema.ts       ← single source of truth for DB schema + Zod validators
server/db.ts           ← creates the Drizzle `db` instance (pg Pool + DATABASE_URL)
server/storage.ts      ← IStorage interface + Storage class (all DB operations)
server/routes.ts       ← Express route handlers; calls storage.*, cometchat.*, notifications.*
server/index.ts        ← server entry: registers routes, Vite middleware, starts HTTP server
```

### Schema & Migrations

Schema lives in `shared/schema.ts` (Drizzle `pgTable` definitions). Types are inferred directly — e.g. `typeof users.$inferSelect` — and re-exported for use in the server and mobile service layer. Run `npm run db:push` to apply changes; migration files land in `./migrations/`.

Key tables: `users`, `bubbles`, `memberships`, `categories`, `campuses`, `events`, `eventAttendees`, `bubbleChats`, `adminMemberChats`, `notifications`, `devicePushTokens`, `reports`, `userSessions`, `bubbleVisits`, `verificationCodes`.

### Authentication

JWT-based. On login/signup, the server signs a token with `JWT_SECRET`. Routes use `authMiddleware` (required auth) or `optionalAuthMiddleware`. The mobile app stores the token in `AsyncStorage` and sends it as `Authorization: Bearer <token>`. The web client stores it in memory/localStorage.

### CometChat Integration

Real-time chat is fully delegated to CometChat. When a bubble is created, a CometChat group is created. When users join/leave a bubble, they are added/removed from the corresponding CometChat group. The server-side helpers live in `server/cometchat.ts`; the mobile SDK wrapper is `mobile/src/services/cometchat.service.ts`.

### Mobile API Service

All HTTP calls from mobile go through `mobile/src/services/api.service.ts`, which wraps `fetch` with JWT attachment and typed response parsing. Add new endpoints there when extending the API.

### Event Timezone Handling

Events are stored in UTC. `server/timezone.ts` provides `localToUtc` / `utcToLocal` helpers. Routes convert incoming local times to UTC before saving and convert back when returning events to clients.

### Bubble Approval Workflow

Newly created bubbles have `status: 'pending'`. Super admins (`isSuperAdmin: true` on the user) can approve or reject via `/api/admin/pending-bubbles`. The same pattern applies to events that require admin approval.

### Path Aliases

`@shared/*` maps to `shared/*` (configured in `tsconfig.json`). Use this alias when importing schema types or utilities from the shared directory.
