// qa-id: rules-1010
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Non-owner cannot create bubble rules (403); empty name rejected (400); no state change on error (UC 146)
//
// UC 146 — Add a custom bubble-level rule. Negative path.
//
// Tests two refusals: (1) a non-owner (role-user) is denied 403 when attempting POST,
// and (2) the owner is rejected with 400 when submitting an empty name. Both cases assert
// no rule was added.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: BUBBLE_TITLE });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token).catch(() => undefined);
});

describe("rules-1010 add a custom bubble-level rule — negative (UC 146)", () => {
  it("non-owner (member) is denied 403 when attempting POST to a bubble they do not own", async () => {
    const res = await request("POST", `/api/rules/bubble/${bubbleId}`, {
      token: member.token,
      body: { name: "Unauthorized Rule" },
    });
    expect(res.status, `POST from non-owner → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);

    // Verify no rule was added
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    expect(
      (list.json ?? []).find((r: any) => r.rule?.name === "Unauthorized Rule"),
      "unauthorized rule should not exist in bubble rules",
    ).toBeFalsy();
  });

  it("owner is rejected 400 when submitting empty name; no rule added", async () => {
    const res = await request("POST", `/api/rules/bubble/${bubbleId}`, {
      token: creator.token,
      body: {},
    });
    expect(res.status, `POST empty body → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);

    // Verify no rule was added
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json), "bubble rules response should be an array").toBe(true);
    expect(list.json?.length ?? 0).toBe(0);
  });
});
