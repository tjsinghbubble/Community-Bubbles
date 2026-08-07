// qa-id: joining-0810
// qa-tags: joining, headless, role-user
// qa-reason: Non-member cannot leave a bubble; POST /leave rejects with 400 and 'Not a member' error (UC 48)
//
// Negative flow: role-user who has NOT joined a disposable Public bubble calls POST /leave
// and receives 400 rejection with error "Not a member". Then asserts no state change:
// membership remains isMember false. Exercises the enforcement that only members can leave.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Leave Bubble Non-Member ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-0810 leave a bubble — non-member rejection", () => {
  it("member's membership reads as isMember false before attempting leave", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
  });

  it("non-member's leave call fails with 400 and 'Not a member' error", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/leave`, { token: member.token });
    expect(res.status, `leave → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.error).toBe("Not a member");
  });

  it("member's membership still reads as isMember false after rejection", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
  });
});
