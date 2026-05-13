import { request } from "@playwright/test";
import fs from "fs";
import path from "path";

export const CTX_FILE = path.join(
  process.cwd(),
  "server/__tests__/e2e/.test-context.json"
);

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

// george@seinfeld.com is created by the startup super-admin seed whenever
// NODE_ENV !== "development" — which includes NODE_ENV=test.
const ADMIN_EMAIL = "george@seinfeld.com";
const ADMIN_PASSWORD = "Bubble123!";

// Unique per run so parallel CI jobs don't clash
const RUN_ID = Date.now();
const USER_EMAIL = `e2e-user-${RUN_ID}@e2e.test`;
const USER_PASSWORD = "TestPass123!";

async function loginWithRetry(
  ctx: Awaited<ReturnType<typeof request.newContext>>,
  email: string,
  password: string,
  retries = 10
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password },
    });
    if (res.ok()) {
      const body = await res.json();
      return body.token as string;
    }
    // Startup seed is async — wait and retry
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Login failed for ${email} after ${retries} attempts`);
}

export default async function globalSetup() {
  const ctx = await request.newContext();

  // 1. Wait for admin account created by startup seed, then get token
  const adminToken = await loginWithRetry(ctx, ADMIN_EMAIL, ADMIN_PASSWORD);

  // 2. Create a regular test user via the public signup API
  const signupRes = await ctx.post(`${BASE_URL}/api/auth/signup`, {
    data: {
      name: "E2E Test User",
      email: USER_EMAIL,
      password: USER_PASSWORD,
      interests: ["Running", "Cooking", "Yoga"],
    },
  });
  if (!signupRes.ok()) {
    throw new Error(`E2E user signup failed: ${await signupRes.text()}`);
  }
  const { token: userToken } = await signupRes.json();

  // 3. Create and approve a test bubble so deep-link tests have a known shortId
  let bubbleId: string | null = null;
  let bubbleShortId: string | null = null;
  let eventId: string | null = null;
  let eventShortId: string | null = null;

  const bubbleRes = await ctx.post(`${BASE_URL}/api/bubbles`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      title: `E2E Test Bubble ${RUN_ID}`,
      tagline: "Created by the E2E test suite",
      category: "Social",
      description: "Automated test bubble — safe to ignore.",
      privacy: "Public",
    },
  });

  if (bubbleRes.ok()) {
    const bubble = await bubbleRes.json();
    bubbleId = bubble.id as string;
    bubbleShortId = bubble.shortId as string;

    // Approve it so share-link routes return real data
    await ctx.post(`${BASE_URL}/api/admin/bubbles/${bubbleId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 4. Create and approve a test event inside that bubble
    const eventRes = await ctx.post(`${BASE_URL}/api/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        bubbleId,
        title: `E2E Test Event ${RUN_ID}`,
        description: "Automated test event — safe to ignore.",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: "14:00",
        endTime: "16:00",
        privacy: "Public",
        locationTbd: true,
      },
    });

    if (eventRes.ok()) {
      const event = await eventRes.json();
      eventId = event.id as string;
      eventShortId = event.shortId as string;

      await ctx.post(`${BASE_URL}/api/admin/events/${eventId}/approve`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
  }

  // 5. Persist shared context for test files to read
  fs.writeFileSync(
    CTX_FILE,
    JSON.stringify(
      {
        adminToken,
        adminEmail: ADMIN_EMAIL,
        userToken,
        userEmail: USER_EMAIL,
        bubbleId,
        bubbleShortId,
        eventId,
        eventShortId,
      },
      null,
      2
    )
  );

  await ctx.dispose();
}
