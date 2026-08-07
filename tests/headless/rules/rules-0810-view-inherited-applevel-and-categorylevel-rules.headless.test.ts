// qa-id: rules-0810
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: A bubble's effective rules include global app rules but NOT another bubble's bubble-level rules (UC 144 negative)
//
// UC 144 — View inherited app- and category-level rules (bubble admin). Negative path.
//
// App rules are GLOBAL (every bubble inherits them), so the meaningful isolation negative
// is: a BUBBLE-level rule belonging to a DIFFERENT bubble must NOT leak into this bubble's
// effective rules. We also confirm the global app rule DOES appear (positive control).
// NOTE: category-rule inheritance needs a bubble linked to a category by numeric id, which
// the disposable fixture does not set, so category-level leakage is not exercised here
// (left to a future test). Hence `unverified`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let siteAdmin!: RoleSession;
let bubbleAdmin!: RoleSession;
let appRuleId: number | string | undefined;
let bubbleId: string | undefined;
let otherBubbleId: string | undefined;
const APP_RULE_NAME = `QA Inherited Rule ${Date.now()}`;
const FOREIGN_BUBBLE_RULE = `QA Foreign Bubble Rule ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  bubbleAdmin = await loginAs("role-bubble-admin");

  const appRes = await request("POST", "/api/rules/app", {
    token: siteAdmin.token,
    body: { name: APP_RULE_NAME },
  });
  if (appRes.status === 200) appRuleId = appRes.json?.rule?.id ?? appRes.json?.ruleId;

  // The bubble under test, and a SEPARATE bubble that owns a "foreign" bubble-level rule.
  bubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, { title: `QA Rules Bubble ${Date.now()}` });
  otherBubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, { title: `QA Other Bubble ${Date.now()}` });
  await request("POST", `/api/rules/bubble/${otherBubbleId}`, {
    token: bubbleAdmin.token,
    body: { name: FOREIGN_BUBBLE_RULE },
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, bubbleAdmin.token).catch(() => undefined);
  await deleteBubble(otherBubbleId, bubbleAdmin.token).catch(() => undefined);
  if (appRuleId != null) {
    await request("DELETE", `/api/rules/app/${appRuleId}`, { token: siteAdmin.token }).catch(() => undefined);
  }
});

describe("rules-0810 view inherited rules — no cross-bubble leakage (UC 144 negative)", () => {
  it("the global app rule is inherited into the bubble's effective rules (positive control)", async () => {
    const res = await request("GET", `/api/rules/effective/${bubbleId}`, { token: bubbleAdmin.token });
    expect(res.status, `GET /api/rules/effective/${bubbleId} → ${res.status}`).toBe(200);
    expect(Array.isArray(res.json), "effective rules must be an array").toBe(true);
    const inherited = (res.json ?? []).find((r: any) => r.name === APP_RULE_NAME);
    expect(inherited, `global app rule '${APP_RULE_NAME}' should be inherited`).toBeTruthy();
  });

  it("another bubble's bubble-level rule does NOT leak into this bubble's effective rules", async () => {
    const res = await request("GET", `/api/rules/effective/${bubbleId}`, { token: bubbleAdmin.token });
    expect(res.status).toBe(200);
    const foreign = (res.json ?? []).find((r: any) => r.name === FOREIGN_BUBBLE_RULE);
    expect(foreign, `foreign bubble rule '${FOREIGN_BUBBLE_RULE}' must not appear here`).toBeUndefined();
  });
});
