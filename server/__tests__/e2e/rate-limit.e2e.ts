import { test, expect } from "@playwright/test";

// Each test uses a unique email so rate-limit state is isolated between tests
function uniqueEmail() {
  return `rate-limit-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
}

test.describe("Rate limiting — login", () => {
  test("account locks after 5 consecutive wrong passwords", async ({
    request,
  }) => {
    const email = uniqueEmail();

    // Signup so the account exists
    await request.post("/api/auth/signup", {
      data: {
        name: "Rate Limit Test",
        email,
        password: "TestPass123!",
        interests: ["Running", "Cooking", "Yoga"],
      },
    });

    // 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      const res = await request.post("/api/auth/login", {
        data: { email, password: "WrongPassword!" },
      });
      expect(res.status()).toBe(401);
    }

    // 6th attempt — should be locked regardless of password
    const lockedRes = await request.post("/api/auth/login", {
      data: { email, password: "WrongPassword!" },
    });
    expect(lockedRes.status()).toBe(429);
    const body = await lockedRes.json();
    expect(body.error).toMatch(/lock|attempt/i);
  });

  test("correct password also fails while account is locked", async ({
    request,
  }) => {
    const email = uniqueEmail();
    const password = "TestPass123!";

    await request.post("/api/auth/signup", {
      data: {
        name: "Rate Limit Test 2",
        email,
        password,
        interests: ["Running", "Cooking", "Yoga"],
      },
    });

    // Exhaust attempts
    for (let i = 0; i < 5; i++) {
      await request.post("/api/auth/login", {
        data: { email, password: "WrongPassword!" },
      });
    }

    // Correct password while locked
    const res = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(res.status()).toBe(429);
  });

  test("rate limit is per email — a different account is not affected", async ({
    request,
  }) => {
    const victimEmail = uniqueEmail();
    const safeEmail = uniqueEmail();
    const password = "TestPass123!";

    // Create both accounts
    await request.post("/api/auth/signup", {
      data: { name: "Victim", email: victimEmail, password, interests: ["Running", "Cooking", "Yoga"] },
    });
    await request.post("/api/auth/signup", {
      data: { name: "Safe", email: safeEmail, password, interests: ["Running", "Cooking", "Yoga"] },
    });

    // Lock victim account
    for (let i = 0; i < 5; i++) {
      await request.post("/api/auth/login", {
        data: { email: victimEmail, password: "Wrong!" },
      });
    }

    // Safe account should still log in fine
    const res = await request.post("/api/auth/login", {
      data: { email: safeEmail, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
  });
});

test.describe("Rate limiting — payload size", () => {
  test("oversized login payload returns 413", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: {
        email: "test@e2e.test",
        password: "TestPass123!",
        extra: "x".repeat(12 * 1024),
      },
    });
    expect(res.status()).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });
});
