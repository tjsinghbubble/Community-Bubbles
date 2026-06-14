// qa-id: reports-0100
// qa-tags: reports, headless, role-site-admin
// qa-reason: Site admin views waitlisted users on platform admin waitlist endpoint (UC 110)
//
// Positive path: role-site-admin calls GET /api/admin/waitlist and retrieves
// an array of all waitlisted users across bubbles. Setup: creates a Public bubble
// with memberLimit=1 (filled by creator), role-user joins → status "waitlisted",
// then site admin views the platform waitlist and asserts the member is present.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Waitlist View Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
  // Set member limit to 1, which is already filled by the creator
  const limitRes = await request("PUT", `/api/bubbles/${bubbleId}`, {
    token: creator.token,
    body: { memberLimit: 1 },
  });
  if (limitRes.status !== 200) {
    throw new Error(`Failed to set memberLimit: ${limitRes.status} ${limitRes.text.slice(0, 200)}`);
  }
  // Join as member → should be waitlisted
  const joinRes = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  if (joinRes.status !== 200 || joinRes.json?.status !== "waitlisted") {
    throw new Error(`Failed to waitlist member: ${joinRes.status} ${joinRes.text.slice(0, 200)}`);
  }
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("reports-0100 view users on the waitlist", () => {
  it("site admin retrieves platform waitlist and sees waitlisted member", async () => {
    const res = await request("GET", "/api/admin/waitlist", { token: siteAdmin.token });
    expect(res.status, `GET /api/admin/waitlist → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(Array.isArray(res.json), "waitlist should be an array").toBe(true);
    const entry = (res.json ?? []).find(
      (w: any) => w.userId === member.userId && w.bubbleId === bubbleId
    );
    expect(entry, `member ${member.userId} should appear on waitlist for bubble ${bubbleId}`).toBeTruthy();
    expect(entry?.membershipStatus).toBe("waitlisted");
    expect(entry?.bubbleTitle).toBe(TITLE);
  });
});
