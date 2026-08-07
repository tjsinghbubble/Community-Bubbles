// qa-id: rules-0100
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin can view all app-wide rules; a created rule shows in the list (UC 79)
//
// UC 79 — View all app-wide rules. Positive/blue-sky path.
//
// LAYER NOTE: the backlog reserved this as `e2e`, but tests/plan/areas/rules.md rules the
// whole area headless-first (UC 79 is a pure API read), and there is no e2e rules sibling
// to copy. Authored headless per the area doc; see the unit handback — the generator's
// layer heuristic mis-keys "view ... rules" as e2e and should be corrected.
//
// The seed has NO app-wide rules (only one bubble-level rule), so this test CREATES one
// app rule first (UC 80 mechanic) to make the "view" assertion independent of seed
// content, then deletes it in afterAll — never mutating the shared seeded fixtures.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdRuleId: number | undefined;
const NAME = `QA App Rule ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (createdRuleId != null) {
    await request("DELETE", `/api/rules/app/${createdRuleId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("rules-0100 view all app-wide rules (UC 79)", () => {
  it("a created app-wide rule appears in GET /api/rules/app", async () => {
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME, description: "seeded by rules-0100; deleted in afterAll" },
    });
    expect(created.status, `POST /api/rules/app → ${created.status} ${created.text.slice(0, 200)}`).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId, "POST should return the new rule id").toBeTruthy();

    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status, `GET /api/rules/app → ${list.status} ${list.text.slice(0, 200)}`).toBe(200);
    expect(Array.isArray(list.json), "app-rules response should be an array").toBe(true);

    const mine = (list.json ?? []).find((r: any) => r.rule?.name === NAME);
    expect(mine, `created rule '${NAME}' is missing from the app-wide rules list`).toBeTruthy();
    expect(mine.rule.id, "listed rule id should match the created rule").toBe(createdRuleId);
  });
});
