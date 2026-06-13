// qa-id: rules-0910
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Non-owner is denied from overriding an inherited rule; the rule remains visible in effective rules (UC 145 negative)
//
// UC 145 — Hide (override) an inherited rule from displaying in their bubble.
// Negative path.
//
// Tests authorization denial: a role-user (non-owner) attempts to POST an override
// to hide an inherited rule on a bubble they don't own (403). Verifies the rule
// is still visible in the bubble's effective rules after the failed override.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let siteAdmin!: RoleSession;
let bubbleAdmin!: RoleSession;
let member!: RoleSession;
let appRuleId: number | string | undefined;
let bubbleId: string | undefined;
const APP_RULE_NAME = `QA Override Test Rule ${Date.now()}`;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  bubbleAdmin = await loginAs("role-bubble-admin");
  member = await loginAs("role-user");

  // Create an app rule
  const appRes = await request("POST", "/api/rules/app", {
    token: siteAdmin.token,
    body: { name: APP_RULE_NAME, description: "to test override denial" },
  });
  if (appRes.status === 200) {
    appRuleId = appRes.json?.rule?.id ?? appRes.json?.ruleId;
  }

  // Create a disposable bubble owned by bubbleAdmin
  bubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, {
    title: BUBBLE_TITLE,
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, bubbleAdmin.token);
  if (appRuleId != null) {
    await request("DELETE", `/api/rules/app/${appRuleId}`, {
      token: siteAdmin.token,
    }).catch(() => undefined);
  }
});

describe("rules-0910 hide (override) an inherited rule — authorization denial (UC 145)", () => {
  it("role-user is denied from posting an override on a bubble they don't own (403)", async () => {
    const res = await request("POST", `/api/rules/bubble/${bubbleId}/override`, {
      token: member.token,
      body: { ruleId: appRuleId, hidden: true },
    });
    expect(
      res.status,
      `POST /api/rules/bubble/${bubbleId}/override as non-owner → ${res.status}`,
    ).toBe(403);
  });

  it("after override denial, the rule is still visible in the bubble's effective rules", async () => {
    const res = await request("GET", `/api/rules/effective/${bubbleId}`, {
      token: bubbleAdmin.token,
    });
    expect(res.status, `GET /api/rules/effective/${bubbleId} → ${res.status}`).toBe(200);
    // effective-rules entries are FLAT ({level, ruleId, name, text, hidden, ...}), not nested under .rule
    const rule = (res.json ?? []).find((r: any) => r.name === APP_RULE_NAME);
    expect(rule, `rule '${APP_RULE_NAME}' should still be visible after failed override`).toBeTruthy();
  });
});
