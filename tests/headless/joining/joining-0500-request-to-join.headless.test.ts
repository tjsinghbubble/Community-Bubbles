// qa-id: joining-0500
// qa-tags: joining, smoke, headless, role-user
// qa-reason: Request to join a Request-to-Join bubble lands as 'pending' and reaches the admin queue (UC 44 + 215)
//
// Covers UC 44 (request to join) and its confirmation UC 215: the member's join call
// returns status 'pending' (what the app surfaces as "Request Sent"), the membership
// reads back as pending-not-member, and the request shows up in the owning admin's
// join-request queue. Approval/rejection are separate use cases (rows 79–80) and are
// deliberately NOT exercised here.
//
// Uses a disposable Request-to-Join bubble (created + site-admin-approved per run) so
// the shared seeded bubbles and the e2e join flows are never touched.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA RtJ Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Request to Join",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-0500 request to join a Request-to-Join bubble", () => {
  it("member's join call is accepted as a pending request", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
    expect(res.status, `join → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.status, "Request-to-Join must NOT grant instant membership").toBe("pending");
  });

  it("membership reads back as pending, not member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
    expect(res.json?.membershipStatus).toBe("pending");
  });

  it("the request appears in the bubble admin's join-request queue", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/join-requests`, { token: creator.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const mine = (res.json ?? []).find((r: any) => r.userId === member.userId);
    expect(mine, `request from ${member.userId} missing from join-requests`).toBeTruthy();
    expect(mine?.membershipStatus).toBe("pending");
  });
});
