// qa-id: monitoring-0800
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site-admin GET /api/admin/pending-count returns count; creating a pending bubble increments it (UC 105)
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let bubbleAdmin!: RoleSession;
let createdBubbleId: string | undefined;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  bubbleAdmin = await loginAs("role-bubble-admin");
});

afterAll(async () => {
  if (createdBubbleId != null) {
    await request("DELETE", `/api/bubbles/${createdBubbleId}`, {
      token: bubbleAdmin.token,
    }).catch(() => undefined);
  }
});

describe("monitoring-0800 view count of pending items awaiting review (UC 105)", () => {
  it("site-admin GET /api/admin/pending-count returns initial count; creating a pending bubble increments it", async () => {
    // Get initial pending count
    const initialCount = await request("GET", "/api/admin/pending-count", {
      token: siteAdmin.token,
    });
    expect(initialCount.status, `GET /api/admin/pending-count → ${initialCount.status}`).toBe(200);
    expect(typeof initialCount.json?.count, "count should be a number").toBe("number");
    expect(initialCount.json.count >= 0, "count should be >= 0").toBe(true);
    const countBefore = initialCount.json.count;

    // Create a pending bubble (status='pending' by default)
    const uniqueTitle = `QA Pending Bubble ${Date.now()}`;
    const createdBubble = await request("POST", "/api/bubbles", {
      token: bubbleAdmin.token,
      body: {
        title: uniqueTitle,
        tagline: "Test pending bubble",
        category: "other",
        description: "Disposable pending bubble for monitoring-0800",
      },
    });
    expect(createdBubble.status, `POST /api/bubbles → ${createdBubble.status}`).toBe(200);
    createdBubbleId = createdBubble.json?.id;
    expect(createdBubbleId, "created bubble should have an id").toBeTruthy();

    // Get pending count after creation
    const afterCount = await request("GET", "/api/admin/pending-count", {
      token: siteAdmin.token,
    });
    expect(afterCount.status, `GET /api/admin/pending-count (after create) → ${afterCount.status}`).toBe(200);
    expect(typeof afterCount.json?.count, "count should be a number").toBe("number");

    // Verify count increased by at least 1
    expect(afterCount.json.count >= countBefore + 1, "pending count should increment by at least 1").toBe(true);

    // Also verify stats.pendingReview.bubbles is present via /api/admin/stats
    const stats = await request("GET", "/api/admin/stats", {
      token: siteAdmin.token,
    });
    expect(stats.status, `GET /api/admin/stats → ${stats.status}`).toBe(200);
    expect(typeof stats.json?.stats?.pendingReview?.bubbles, "stats.pendingReview.bubbles should be a number").toBe(
      "number",
    );
  });
});
