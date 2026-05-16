import { test, expect } from "@playwright/test";

// Each test creates its own unique user so tests are fully independent
function uniqueEmail() {
  return `e2e-auth-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
}

const VALID_SIGNUP = {
  name: "Auth Test User",
  password: "TestPass123!",
  interests: ["Running", "Cooking", "Yoga"],
};

test.describe("Auth — signup", () => {
  test("valid signup returns 200 with token and user", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email: uniqueEmail() },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(body.user).toHaveProperty("email");
    expect(body.user).not.toHaveProperty("password");
  });

  test("duplicate email returns 400", async ({ request }) => {
    const email = uniqueEmail();
    await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email },
    });
    const res = await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exists/i);
  });

  test("missing password returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { name: "Test", email: uniqueEmail() },
    });
    expect(res.status()).toBe(400);
  });

  test("password under 8 chars returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email: uniqueEmail(), password: "short" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid email format returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email: "not-an-email" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Auth — login → me → logout lifecycle", () => {
  test("full lifecycle works end-to-end", async ({ request }) => {
    const email = uniqueEmail();

    // 1. Signup
    const signupRes = await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email },
    });
    expect(signupRes.status()).toBe(200);
    const { token } = await signupRes.json();

    // 2. GET /api/auth/me with valid token
    const meRes = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    expect(me.email).toBe(email);
    expect(me).not.toHaveProperty("password");

    // 3. GET /api/auth/me without token returns 401
    const noTokenRes = await request.get("/api/auth/me");
    expect(noTokenRes.status()).toBe(401);

    // 4. Logout
    const logoutRes = await request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status()).toBe(200);

    // 5. Token is now invalid
    const afterLogoutRes = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterLogoutRes.status()).toBe(401);
  });

  test("login with wrong password returns 401", async ({ request }) => {
    const email = uniqueEmail();
    await request.post("/api/auth/signup", {
      data: { ...VALID_SIGNUP, email },
    });

    const res = await request.post("/api/auth/login", {
      data: { email, password: "WrongPassword1" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test("login for non-existent user returns 401", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "nobody-ever@e2e.test", password: "TestPass123!" },
    });
    expect(res.status()).toBe(401);
  });

  test("tampered token returns 401 on protected route", async ({ request }) => {
    const res = await request.get("/api/auth/me", {
      headers: { Authorization: "Bearer this.is.not.a.valid.jwt" },
    });
    expect(res.status()).toBe(401);
  });
});
