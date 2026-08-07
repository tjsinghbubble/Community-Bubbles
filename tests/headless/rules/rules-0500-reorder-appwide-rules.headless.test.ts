// qa-id: rules-0500
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin creates two rules, swaps their order via PUT /api/rules/app/reorder, verifies order change persists (UC 83)
//
// UC 83 — Reorder app-wide rules. Positive/blue-sky path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let ruleAId: number | undefined;
let ruleBId: number | undefined;
const NAME_A = `QA Rule A ${Date.now()}`;
const NAME_B = `QA Rule B ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (ruleAId != null) {
    await request("DELETE", `/api/rules/app/${ruleAId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
  if (ruleBId != null) {
    await request("DELETE", `/api/rules/app/${ruleBId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("rules-0500 reorder app-wide rules (UC 83)", () => {
  it("site-admin swaps the order of two rules via PUT /api/rules/app/reorder", async () => {
    // Create rule A
    const createdA = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME_A, description: "first rule" },
    });
    expect(createdA.status).toBe(200);
    ruleAId = createdA.json?.rule?.id ?? createdA.json?.ruleId;
    expect(ruleAId).toBeTruthy();

    // Create rule B
    const createdB = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME_B, description: "second rule" },
    });
    expect(createdB.status).toBe(200);
    ruleBId = createdB.json?.rule?.id ?? createdB.json?.ruleId;
    expect(ruleBId).toBeTruthy();

    // Get the current ordered list
    let list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    const currentRules = list.json ?? [];
    expect(Array.isArray(currentRules)).toBe(true);

    // Find the original indices of A and B
    const indexA = currentRules.findIndex((r: any) => r.rule?.id === ruleAId);
    const indexB = currentRules.findIndex((r: any) => r.rule?.id === ruleBId);
    expect(indexA).toBeGreaterThanOrEqual(0);
    expect(indexB).toBeGreaterThanOrEqual(0);

    // Build the new ordered id list by swapping A and B
    const newOrderedIds = currentRules.map((r: any) => r.ruleId ?? r.rule?.id);
    newOrderedIds[indexA] = ruleBId;
    newOrderedIds[indexB] = ruleAId;

    // Reorder via PUT
    const reordered = await request("PUT", "/api/rules/app/reorder", {
      token: siteAdmin.token,
      body: { ruleIds: newOrderedIds },
    });
    expect(reordered.status, `PUT /api/rules/app/reorder → ${reordered.status}`).toBe(200);
    expect(reordered.json?.success).toBe(true);

    // Get the list again and verify the swap
    list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    const updatedRules = list.json ?? [];

    const newIndexA = updatedRules.findIndex((r: any) => r.rule?.id === ruleAId);
    const newIndexB = updatedRules.findIndex((r: any) => r.rule?.id === ruleBId);

    // B should now come before A (or at least the positions should have changed)
    expect(
      newIndexB < newIndexA,
      `After reorder, B (index ${newIndexB}) should come before A (index ${newIndexA})`,
    ).toBe(true);
  });
});
