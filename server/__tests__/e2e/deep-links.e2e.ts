import { test, expect } from "@playwright/test";
import { ctx, authHeader } from "./ctx.ts";

// @prod-safe — GET only, no writes
test.describe("Universal link verification files", () => {
  test("GET /.well-known/apple-app-site-association is valid JSON with bundle ID", async ({
    request,
  }) => {
    const res = await request.get("/.well-known/apple-app-site-association");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("applinks");
    const details: any[] = body.applinks?.details ?? [];
    const bundleIds = details.flatMap((d: any) => d.appIDs ?? [d.appID ?? ""]);
    expect(bundleIds.some((id: string) => id.includes("io.bubble.app"))).toBe(true);
  });

  test("GET /.well-known/assetlinks.json is valid JSON with package name", async ({
    request,
  }) => {
    const res = await request.get("/.well-known/assetlinks.json");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const packageNames = body.flatMap((entry: any) =>
      entry.target ? [entry.target.package_name ?? ""] : []
    );
    expect(
      packageNames.some((p: string) => p.includes("com.bubble.mobile"))
    ).toBe(true);
  });
});

test.describe("Bubble share links", () => {
  test("GET /api/bubbles/short/:shortId returns bubble JSON", async ({
    request,
  }) => {
    const { bubbleShortId, adminToken } = ctx();
    if (!bubbleShortId) {
      test.skip(true, "No test bubble was created in global setup");
      return;
    }
    const res = await request.get(`/api/bubbles/short/${bubbleShortId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("shortId", bubbleShortId);
    expect(body).toHaveProperty("title");
  });

  test("GET /b/:shortId returns HTML with OG tags and deep link", async ({
    request,
  }) => {
    const { bubbleShortId } = ctx();
    if (!bubbleShortId) {
      test.skip(true, "No test bubble was created in global setup");
      return;
    }
    const res = await request.get(`/b/${bubbleShortId}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain(`bubble://b/${bubbleShortId}`);
  });

  test("GET /b/doesnotexist returns 404", async ({ request }) => {
    const res = await request.get("/b/doesnotexist000");
    expect(res.status()).toBe(404);
  });

  test("GET /api/bubbles/short/doesnotexist returns 404", async ({
    request,
  }) => {
    const res = await request.get("/api/bubbles/short/doesnotexist000");
    expect(res.status()).toBe(404);
  });
});

test.describe("Event share links", () => {
  test("GET /api/events/short/:shortId returns event JSON with bubble", async ({
    request,
  }) => {
    const { eventShortId, adminToken } = ctx();
    if (!eventShortId) {
      test.skip(true, "No test event was created in global setup");
      return;
    }
    const res = await request.get(`/api/events/short/${eventShortId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("shortId", eventShortId);
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("bubble");
  });

  test("GET /e/:shortId returns HTML with OG tags and deep link", async ({
    request,
  }) => {
    const { eventShortId } = ctx();
    if (!eventShortId) {
      test.skip(true, "No test event was created in global setup");
      return;
    }
    const res = await request.get(`/e/${eventShortId}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain(`bubble://e/${eventShortId}`);
  });

  test("GET /e/doesnotexist returns 404", async ({ request }) => {
    const res = await request.get("/e/doesnotexist000");
    expect(res.status()).toBe(404);
  });

  test("GET /api/events/short/doesnotexist returns 404", async ({
    request,
  }) => {
    const res = await request.get("/api/events/short/doesnotexist000");
    expect(res.status()).toBe(404);
  });
});
