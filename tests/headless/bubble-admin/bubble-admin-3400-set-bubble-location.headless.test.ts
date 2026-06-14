// qa-id: bubble-admin-3400
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify owner can set location fields on their bubble (UC 133)
//
// Positive path: role-bubble-admin creates a bubble, then sets locationName, locationAddress,
// locationLat, and locationLng. The PUT succeeds (200) and a subsequent GET confirms the
// location fields are set.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Set Location ${Date.now()}`;
const LOCATION_NAME = `QA Park ${Date.now()}`;
const LOCATION_ADDRESS = "123 Test St";
// Coordinates are validated/stored as STRINGS (updateBubbleSchema: z.string), and the
// server runs truncateCoord() on them, so we assert the locationName/Address round-trip
// (untransformed strings) rather than exact lat/lng equality.
const LOCATION_LAT = "37.8";
const LOCATION_LNG = "-122.27";

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-3400 set bubble location", () => {
  it("owner sets location fields → 200", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: owner.token,
      body: {
        locationName: LOCATION_NAME,
        locationAddress: LOCATION_ADDRESS,
        locationLat: LOCATION_LAT,
        locationLng: LOCATION_LNG,
      },
    });
    expect(res.status, `PUT /api/bubbles/${bubbleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
  });

  it("bubble location fields read back correctly", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status).toBe(200);
    expect(res.json?.locationName, "locationName must match").toBe(LOCATION_NAME);
    expect(res.json?.locationAddress, "locationAddress must match").toBe(LOCATION_ADDRESS);
    // lat/lng are truncated server-side; just assert they were stored (non-null).
    expect(res.json?.locationLat, "locationLat must be stored").toBeTruthy();
    expect(res.json?.locationLng, "locationLng must be stored").toBeTruthy();
  });
});
