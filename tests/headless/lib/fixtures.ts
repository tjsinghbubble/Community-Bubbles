/** Disposable bubble/event fixtures for headless tests.
 *
 * Each test file creates its OWN bubble (and events inside it) instead of mutating the
 * shared seeded bubbles, so headless files stay order-independent of each other and of
 * the e2e join flows. Titles must be unique per run (caller appends Date.now()).
 * Cleanup is best-effort: the qa seed truncates the disposable bubble_test DB anyway.
 */
import { request, type RoleSession } from "./auth.js";

/** Submit a bubble as `creator`, then approve it as `approver` (site admin) so it is
 *  live — the same real pipeline site-admin-0100 verifies end-to-end. */
export async function createApprovedBubble(
  creator: RoleSession,
  approver: RoleSession,
  opts: { title: string; privacy?: "Public" | "Request to Join" | "Private" },
): Promise<string> {
  const created = await request("POST", "/api/bubbles", {
    token: creator.token,
    body: {
      title: opts.title,
      tagline: "headless fixture bubble",
      category: "General",
      description: "Created by a headless test; deleted in afterAll.",
      ...(opts.privacy ? { privacy: opts.privacy } : {}),
    },
  });
  if (created.status !== 200 || !created.json?.id) {
    throw new Error(`fixture: POST /api/bubbles → ${created.status} ${created.text.slice(0, 200)}`);
  }
  const id: string = created.json.id;
  const approved = await request("POST", `/api/admin/bubbles/${id}/approve`, {
    token: approver.token,
  });
  if (approved.status !== 200) {
    throw new Error(`fixture: approve bubble ${id} → ${approved.status} ${approved.text.slice(0, 200)}`);
  }
  return id;
}

/** Create an approved event (events need no admin approval; status defaults 'approved'). */
export async function createEvent(
  creator: RoleSession,
  bubbleId: string,
  title: string,
): Promise<string> {
  const res = await request("POST", "/api/events", {
    token: creator.token,
    body: { bubbleId, title, date: "2027-03-01", startTime: "18:00", timezone: "UTC" },
  });
  if (res.status !== 200 || !res.json?.id) {
    throw new Error(`fixture: POST /api/events → ${res.status} ${res.text.slice(0, 200)}`);
  }
  return res.json.id;
}

/** Best-effort bubble teardown (soft delete; owner or site admin token). */
export async function deleteBubble(id: string | undefined, token: string): Promise<void> {
  if (!id) return;
  await request("DELETE", `/api/bubbles/${id}`, { token }).catch(() => undefined);
}
