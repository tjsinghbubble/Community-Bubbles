// qa-id: joining-1010
// qa-tags: joining, headless, role-user, security
// qa-reason: Empty reason in bubble report is rejected with 400; no report created (UC 50 negative)
//
// Negative path: role-user POSTs a bubble report with empty reason and receives HTTP 400.
// The schema requires `reason: z.string().min(1).max(500)`, so empty string is invalid.
// Uses the same disposable bubble fixture as joining-1000.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Report Bubble ${Date.now()}`;

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

describe("joining-1010 report a concern about a bubble — empty reason rejected", () => {
  it("empty reason is rejected with 400 and no report is created", async () => {
    const res = await request("POST", "/api/reports", {
      token: member.token,
      body: {
        reportType: "bubble",
        reason: "",
        bubbleId,
      },
    });
    expect(res.status, `report with empty reason → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.id, "no report id should be present in 400 response").toBeUndefined();
    expect(res.json?.error, "error message should be present").toBeTruthy();
  });
});
