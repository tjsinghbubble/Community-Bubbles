// qa-id: joining-0510
// qa-tags: joining, smoke, headless, role-user
// qa-reason: A second join request while one is pending is rejected, not duplicated (negative for UC 44)
//
// Named negative variant of joining-0500: re-submitting a join request must 400 with
// "Join request already pending" and must NOT create a second queue entry or escalate
// the membership. Guards the double-tap / retry path in the app.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA RtJ Dup Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Request to Join",
  });
  const first = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  if (first.status !== 200 || first.json?.status !== "pending") {
    throw new Error(`setup: first join → ${first.status} ${first.text.slice(0, 200)}`);
  }
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-0510 duplicate join request is rejected", () => {
  it("second join call → 400 'Join request already pending'", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
    expect(res.status, `duplicate join → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.error).toMatch(/already pending/i);
  });

  it("membership is still pending (not escalated, not dropped)", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
    expect(res.json?.membershipStatus).toBe("pending");
  });

  it("the admin queue holds exactly ONE request for this member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/join-requests`, { token: creator.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const mine = (res.json ?? []).filter((r: any) => r.userId === member.userId);
    expect(mine.length, "duplicate join must not duplicate the queue entry").toBe(1);
  });
});
