// qa-id: bubble-admin-0700
// qa-tags: bubble-admin, smoke, headless, role-bubble-admin
// qa-reason: Bubble admin can edit their own bubble's details (UC 26)
//
// Positive counterpart to sec-0200's deny matrix: PUT /api/bubbles/:id is proven to
// 403 lower-privilege callers there; this proves it actually WORKS for the owner, so
// a future gate change that denies everyone (admins included) fails here, not in prod.
//
// Edits tagline + description only — never the title. Other tests (sec-0200, seeds)
// locate the seeded bubble by title "QA Test Bubble", and headless files may run in
// parallel batches. Originals are restored at the end; the qa seed truncates the
// disposable bubble_test DB on the next run regardless.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let admin!: RoleSession;
let bubbleId!: string;
let originalTagline!: string;
let originalDescription!: string;

const PROBE_TAGLINE = "QA edited tagline (bubble-admin-0700)";
const PROBE_DESCRIPTION = "QA edited description (bubble-admin-0700)";

beforeAll(async () => {
  admin = await loginAs("role-bubble-admin");
  const bubbles = await request("GET", "/api/bubbles");
  const qaBubble = (bubbles.json ?? []).find((b: any) => b.title === "QA Test Bubble");
  if (!qaBubble) throw new Error("seeded 'QA Test Bubble' not found — run npm run qa:seed");
  bubbleId = qaBubble.id;
  originalTagline = qaBubble.tagline;
  originalDescription = qaBubble.description;
});

afterAll(async () => {
  // Best-effort restore so a re-run without reseeding starts from the seeded values.
  if (!bubbleId) return;
  await request("PUT", `/api/bubbles/${bubbleId}`, {
    token: admin.token,
    body: { tagline: originalTagline, description: originalDescription },
  });
});

describe("bubble-admin-0700 edit own bubble details", () => {
  it("PUT /api/bubbles/:id as the owning bubble admin → 200 with the new values", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: admin.token,
      body: { tagline: PROBE_TAGLINE, description: PROBE_DESCRIPTION },
    });
    expect(res.status, `PUT /api/bubbles/${bubbleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.tagline).toBe(PROBE_TAGLINE);
    expect(res.json?.description).toBe(PROBE_DESCRIPTION);
  });

  it("the edit persists on a fresh read", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.tagline).toBe(PROBE_TAGLINE);
    expect(res.json?.description).toBe(PROBE_DESCRIPTION);
    expect(res.json?.title, "title must never be touched by this test").toBe("QA Test Bubble");
  });

  it("restore puts the seeded values back", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: admin.token,
      body: { tagline: originalTagline, description: originalDescription },
    });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.tagline).toBe(originalTagline);
    expect(res.json?.description).toBe(originalDescription);
  });
});
