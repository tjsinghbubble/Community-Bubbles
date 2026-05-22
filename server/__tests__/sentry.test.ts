import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/node", () => {
  const scopeMock = {
    setLevel: vi.fn(),
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setFingerprint: vi.fn(),
  };
  const withScope = vi.fn((cb: (scope: unknown) => void) => {
    cb(scopeMock);
  });
  const captureMessage = vi.fn();
  const init = vi.fn();

  return { withScope, captureMessage, init, __scopeMock: scopeMock };
});

import * as Sentry from "@sentry/node";
import { initialiseSentry, reportSlowResponse, __resetForTesting } from "../sentry.js";

const sentryMod = Sentry as typeof Sentry & {
  __scopeMock: {
    setLevel: ReturnType<typeof vi.fn>;
    setTag: ReturnType<typeof vi.fn>;
    setExtra: ReturnType<typeof vi.fn>;
    setFingerprint: ReturnType<typeof vi.fn>;
  };
};

describe("initialiseSentry", () => {
  beforeEach(() => {
    __resetForTesting();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.BUBBLE_SENTRY_USAGE;
  });

  it("no-ops gracefully when SENTRY_DSN is absent", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    initialiseSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it("calls Sentry.init when SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://fake@sentry.io/123";
    process.env.BUBBLE_SENTRY_USAGE = "local";
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    initialiseSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://fake@sentry.io/123" }),
    );
    consoleLogSpy.mockRestore();
  });

  it("does not call Sentry.init a second time when called twice", () => {
    process.env.SENTRY_DSN = "https://fake@sentry.io/123";
    process.env.BUBBLE_SENTRY_USAGE = "local";
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    initialiseSentry();
    initialiseSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    consoleLogSpy.mockRestore();
  });
});

describe("reportSlowResponse — threshold", () => {
  beforeEach(() => {
    __resetForTesting();
    vi.clearAllMocks();
    process.env.SENTRY_DSN = "https://fake@sentry.io/123";
    process.env.BUBBLE_SENTRY_USAGE = "local";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    initialiseSentry();
  });

  it("does NOT report when duration is below the 1,000 ms threshold", () => {
    reportSlowResponse("GET", "/api/users", 999);
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("DOES report when duration is exactly 1,000 ms (at-threshold boundary)", () => {
    reportSlowResponse("GET", "/api/users", 1000);
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
  });

  it("DOES report when duration is above the 1,000 ms threshold", () => {
    reportSlowResponse("GET", "/api/users", 1001);
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
  });
});

describe("reportSlowResponse — Sentry scope values", () => {
  beforeEach(() => {
    __resetForTesting();
    vi.clearAllMocks();
    process.env.SENTRY_DSN = "https://fake@sentry.io/123";
    process.env.BUBBLE_SENTRY_USAGE = "local";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    initialiseSentry();
  });

  it("sets the correct scope level, tags, extras, and fingerprint", () => {
    reportSlowResponse("post", "/api/messages", 1500);

    const scope = sentryMod.__scopeMock;

    expect(scope.setLevel).toHaveBeenCalledWith("warning");
    expect(scope.setTag).toHaveBeenCalledWith("alert_type", "slow_api_response");
    expect(scope.setTag).toHaveBeenCalledWith("endpoint", "/api/messages");
    expect(scope.setTag).toHaveBeenCalledWith("method", "POST");
    expect(scope.setExtra).toHaveBeenCalledWith("durationMs", 1500);
    expect(scope.setExtra).toHaveBeenCalledWith("threshold", 1000);
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      "api-slow-response-alert",
      "POST",
      "/api/messages",
    ]);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[API] Slow response: POST /api/messages (1500 ms)",
      "warning",
    );
  });

  it("normalises numeric path segments to :id", () => {
    reportSlowResponse("GET", "/api/users/42/profile", 2000);

    const scope = sentryMod.__scopeMock;
    expect(scope.setTag).toHaveBeenCalledWith("endpoint", "/api/users/:id/profile");
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      "api-slow-response-alert",
      "GET",
      "/api/users/:id/profile",
    ]);
  });

  it("normalises UUID path segments to :id", () => {
    reportSlowResponse(
      "DELETE",
      "/api/bubbles/550e8400-e29b-41d4-a716-446655440000",
      3000,
    );

    const scope = sentryMod.__scopeMock;
    expect(scope.setTag).toHaveBeenCalledWith("endpoint", "/api/bubbles/:id");
  });
});

describe("reportSlowResponse — occurrence counter", () => {
  beforeEach(() => {
    __resetForTesting();
    vi.clearAllMocks();
    process.env.SENTRY_DSN = "https://fake@sentry.io/123";
    process.env.BUBBLE_SENTRY_USAGE = "local";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    initialiseSentry();
  });

  it("starts the occurrence counter at 1 on the first slow response", () => {
    reportSlowResponse("GET", "/api/feed", 1200);

    const scope = sentryMod.__scopeMock;
    expect(scope.setExtra).toHaveBeenCalledWith("occurrences", 1);
  });

  it("increments the occurrence counter on subsequent slow responses for the same endpoint", () => {
    reportSlowResponse("GET", "/api/feed", 1200);
    reportSlowResponse("GET", "/api/feed", 1300);
    reportSlowResponse("GET", "/api/feed", 1400);

    const scope = sentryMod.__scopeMock;
    const occurrenceCalls = scope.setExtra.mock.calls.filter(
      ([key]: [string]) => key === "occurrences",
    );
    expect(occurrenceCalls[0][1]).toBe(1);
    expect(occurrenceCalls[1][1]).toBe(2);
    expect(occurrenceCalls[2][1]).toBe(3);
  });

  it("tracks occurrence counters independently per endpoint", () => {
    reportSlowResponse("GET", "/api/feed", 1100);
    reportSlowResponse("POST", "/api/messages", 1100);
    reportSlowResponse("GET", "/api/feed", 1100);

    const scope = sentryMod.__scopeMock;
    const occurrenceCalls = scope.setExtra.mock.calls.filter(
      ([key]: [string]) => key === "occurrences",
    );

    expect(occurrenceCalls[0][1]).toBe(1);
    expect(occurrenceCalls[1][1]).toBe(1);
    expect(occurrenceCalls[2][1]).toBe(2);
  });

  it("does not increment the counter for fast responses", () => {
    reportSlowResponse("GET", "/api/feed", 500);
    reportSlowResponse("GET", "/api/feed", 1500);

    const scope = sentryMod.__scopeMock;
    const occurrenceCalls = scope.setExtra.mock.calls.filter(
      ([key]: [string]) => key === "occurrences",
    );
    expect(occurrenceCalls).toHaveLength(1);
    expect(occurrenceCalls[0][1]).toBe(1);
  });
});

describe("reportSlowResponse — not initialised", () => {
  it("does not call Sentry when initialiseSentry was not called", () => {
    __resetForTesting();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.BUBBLE_SENTRY_USAGE;

    reportSlowResponse("GET", "/api/slow", 5000);

    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
