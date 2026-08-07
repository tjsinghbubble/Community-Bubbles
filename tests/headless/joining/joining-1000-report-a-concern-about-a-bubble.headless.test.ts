// qa-id: joining-1000
// qa-tags: joining, headless, role-user, security
// qa-reason: Member can report a concern about a bubble; report is created with 201 and expected fields (UC 50)
//
// Positive path: role-user POSTs a valid bubble report with non-empty reason against a
// disposable bubble and receives HTTP 201 with the created report's id, status, and reason.
// The disposable bubble is created in beforeAll and deleted in afterAll so the test does not
// pollute seeded fixtures.
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

describe("joining-1000 report a concern about a bubble", () => {
  it("member can submit a valid bubble report and receives 201 with report details", async () => {
    const reportReason = "This bubble contains harmful content";
    const res = await request("POST", "/api/reports", {
      token: member.token,
      body: {
        reportType: "bubble",
        reason: reportReason,
        bubbleId,
      },
    });
    expect(res.status, `report creation → ${res.status} ${res.text.slice(0, 200)}`).toBe(201);
    expect(res.json?.id, "report should have an id").toBeTruthy();
    expect(res.json?.status).toBe("pending");
    expect(res.json?.reason).toBe(reportReason);
    expect(res.json?.bubbleId).toBe(bubbleId);
    expect(res.json?.reportType).toBe("bubble");
  });
});
