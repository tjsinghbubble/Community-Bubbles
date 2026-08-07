// qa-id: rules-0900
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Bubble owner overrides an inherited rule; it is flagged hidden:true in the bubble's effective rules but remains app-wide (UC 145)
//
// UC 145 — Hide (override) an inherited rule from displaying in their bubble. Positive path.
//
// Creates an APP rule (inherited globally), creates a disposable bubble, verifies the rule
// appears in the bubble's effective rules, then the owner POSTs an override {hidden:true}.
// NOTE: override does NOT remove the rule from getEffectiveRules — it keeps it and sets
// hidden:true (the client is expected to filter). So we assert the entry is present AND
// flagged hidden, and that it still exists app-wide.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let siteAdmin!: RoleSession;
let bubbleAdmin!: RoleSession;
let appRuleId: number | string | undefined;
let bubbleId: string | undefined;
const APP_RULE_NAME = `QA Override Test Rule ${Date.now()}`;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  bubbleAdmin = await loginAs("role-bubble-admin");

  const appRes = await request("POST", "/api/rules/app", {
    token: siteAdmin.token,
    body: { name: APP_RULE_NAME, description: "to be hidden in the bubble" },
  });
  if (appRes.status === 200) appRuleId = appRes.json?.rule?.id ?? appRes.json?.ruleId;

  bubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, { title: BUBBLE_TITLE });
});

afterAll(async () => {
  await deleteBubble(bubbleId, bubbleAdmin.token).catch(() => undefined);
  if (appRuleId != null) {
    await request("DELETE", `/api/rules/app/${appRuleId}`, { token: siteAdmin.token }).catch(() => undefined);
  }
});

describe("rules-0900 hide (override) an inherited rule (UC 145)", () => {
  it("the inherited app rule initially appears (not hidden) in the bubble's effective rules", async () => {
    const res = await request("GET", `/api/rules/effective/${bubbleId}`, { token: bubbleAdmin.token });
    expect(res.status, `GET /api/rules/effective/${bubbleId} → ${res.status}`).toBe(200);
    // effective-rules entries are FLAT ({level, ruleId, name, text, hidden, ...}).
    const rule = (res.json ?? []).find((r: any) => r.name === APP_RULE_NAME);
    expect(rule, `app rule '${APP_RULE_NAME}' should initially appear in effective rules`).toBeTruthy();
    expect(rule?.hidden, "rule should not be hidden before the override").toBe(false);
  });

  it("bubble owner can POST an override to hide the inherited rule", async () => {
    const res = await request("POST", `/api/rules/bubble/${bubbleId}/override`, {
      token: bubbleAdmin.token,
      body: { ruleId: appRuleId, hidden: true },
    });
    expect(res.status, `POST override → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
  });

  it("after the override, the inherited rule is flagged hidden:true in effective rules", async () => {
    const res = await request("GET", `/api/rules/effective/${bubbleId}`, { token: bubbleAdmin.token });
    expect(res.status).toBe(200);
    // Override keeps the rule in the list but sets hidden:true (client filters on display).
    const rule = (res.json ?? []).find((r: any) => r.name === APP_RULE_NAME);
    expect(rule, `overridden rule '${APP_RULE_NAME}' should still be present`).toBeTruthy();
    expect(rule?.hidden, "overridden rule should be flagged hidden:true").toBe(true);
  });

  it("the app rule still exists app-wide (visible to site admin)", async () => {
    const res = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(res.status, `GET /api/rules/app → ${res.status}`).toBe(200);
    // GET /api/rules/app is nested ({...appRule, rule}), unlike the flat effective shape.
    const rule = (res.json ?? []).find((r: any) => r.rule?.name === APP_RULE_NAME);
    expect(rule, `app rule '${APP_RULE_NAME}' should still exist app-wide`).toBeTruthy();
  });
});
