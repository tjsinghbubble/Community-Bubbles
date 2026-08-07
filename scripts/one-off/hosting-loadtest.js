// k6 load script for the Bubble hosting research (docs/research/perf-test-plan.md).
// NOT discovered by the qa runner (--all never runs this); invoke via hosting-loadtest.sh.
//
// Replays a read-heavy weighted API session mix at the peak req/s of a named
// usage scenario (docs/research/usage-scenarios-to-load-model.md).
//
//   k6 run -e SCENARIO=moderate-usage -e BASE_URL=http://127.0.0.1:5000 \
//          --summary-export out.json scripts/one-off/hosting-loadtest.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:5000";
const EMAIL = __ENV.LT_EMAIL || "test@example.com";
const PASSWORD = __ENV.LT_PASSWORD || "TestPass123!";
const DURATION = __ENV.DURATION || "10m";

// peak req/s per scenario, from the load model (mean x10 peak factor), min 1.
const PEAK_RPS = {
  "zero-growth": 1,
  "low-usage": 1,
  "moderate-usage": 2,
  "fast-usage": 4,
  "insane-usage": 52,
  // synthetic headroom probe: find where one container tops out
  "headroom": 200,
};

const scenario = __ENV.SCENARIO || "moderate-usage";
const rps = PEAK_RPS[scenario];
if (!rps) throw new Error(`unknown SCENARIO ${scenario}`);

export const options = {
  scenarios: {
    [scenario]: {
      executor: "constant-arrival-rate",
      rate: rps,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.max(5, Math.ceil(rps / 2)),
      maxVUs: Math.max(20, rps * 2),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200) {
    throw new Error(`login failed ${res.status}: ${res.body && res.body.slice(0, 200)}`);
  }
  return { token: res.json("token") };
}

// Read-heavy session mix: weights approximate one browse session
// (feed/discovery-dominant), all idempotent GETs plus a login write.
// All paths verified 200 for the seeded test user (campus endpoints 403 for
// non-campus users, so they're excluded). Login only in setup(): real sessions
// authenticate once, and repeated logins trip the auth rate limiter (10/15min).
const MIX = [
  { w: 20, name: "bubbles", path: "/api/bubbles" },
  { w: 15, name: "events", path: "/api/events" },
  { w: 12, name: "my-bubbles", path: "/api/bubbles/my" },
  { w: 12, name: "categories", path: "/api/categories" },
  { w: 10, name: "me", path: "/api/auth/me" },
  { w: 8, name: "categories-flat", path: "/api/categories/flat" },
  { w: 8, name: "campuses", path: "/api/campuses" },
  { w: 5, name: "notifications", path: "/api/notifications" },
  { w: 5, name: "unread-count", path: "/api/notifications/unread-count" },
  { w: 5, name: "version", path: "/api/v1/version" },
];
const TOTAL_W = MIX.reduce((s, m) => s + m.w, 0);

function pick() {
  let r = Math.random() * TOTAL_W;
  for (const m of MIX) {
    r -= m.w;
    if (r <= 0) return m;
  }
  return MIX[0];
}

export default function (data) {
  const m = pick();
  const res = http.get(`${BASE}${m.path}`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: m.name },
  });
  check(res, { "status 2xx/3xx": (r) => r.status < 400 });
  sleep(0.1);
}
