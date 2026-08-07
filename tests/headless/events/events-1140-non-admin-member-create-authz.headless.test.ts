// qa-id: events-1140
// qa-tags: events, security, headless, role-user, known-divergence
// qa-reason: Only bubble admins (or site admins) should create events; a non-admin member must be denied (Goal 3)
//
// KNOWN DIVERGENCE — this test is a tripwire, written with it.fails().
//
// Intended policy (the goal): only a bubble admin or a site admin may create events in a bubble.
// Actual code (server/routes.ts POST /api/events, ~line 2657): the admin-role check is applied
// ONLY to Public bubbles. For non-Public bubbles ("Request to Join" / "Private") the gate is a
// bare isMember() check, so ANY approved member can create events there. See Trello defect
// (event-create-private-bubble-member). The e2e/headless picture is otherwise unchanged.
//
// Setup: role-bubble-admin owns a "Request to Join" bubble; role-user joins and is approved as a
// plain 'member' (NOT admin). Per the intended policy that member's POST /api/events should be 403.
//
// it.fails() means: while the divergence EXISTS (server returns 200), the inner 403 expectation
// throws and this test PASSES (green) — recording the known gap without redding the suite. When
// the server is fixed to deny non-admin members, the inner expectation passes, it.fails() then
// FAILS — forcing whoever fixes the code to delete `.fails` and re-tag this as a normal negative
// authz test. Do not "fix" the red by reverting; the red means the bug is gone.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, joinBubbleAsApprovedMember, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession; // role-bubble-admin: owns + admins the bubble
let siteAdmin!: RoleSession;
let plainMember!: RoleSession; // role-user: approved member, role 'member' (not admin)
let bubbleId!: string;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  plainMember = await loginAs("role-user");
  // Non-Public so the create gate is the bare isMember() branch — the divergent path.
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: `QA Member-Create Divergence Bubble ${Date.now()}`,
    privacy: "Request to Join",
  });
  await joinBubbleAsApprovedMember(plainMember, owner, bubbleId);
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("events-1140 non-admin member event creation (intended-policy tripwire)", () => {
  // EXPECTED TO FAIL while the divergence exists: server currently returns 200 here.
  it.fails("INTENDED: non-admin member POST /api/events in a non-Public bubble → 403", async () => {
    const res = await request("POST", "/api/events", {
      token: plainMember.token,
      body: {
        bubbleId,
        title: `QA Member-Created Event ${Date.now()}`,
        date: "2027-03-01",
        startTime: "18:00",
        timezone: "UTC",
      },
    });
    expect(res.status, `POST → ${res.status} ${res.text.slice(0, 200)} (200 == divergence still present)`).toBe(403);
  });
});
