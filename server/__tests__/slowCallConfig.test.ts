import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("slow-call-config — SLOW_CALL_THRESHOLD_MS", () => {
  const ORIGINAL_THRESHOLD = process.env.SLOW_CALL_THRESHOLD_MS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_THRESHOLD === undefined) {
      delete process.env.SLOW_CALL_THRESHOLD_MS;
    } else {
      process.env.SLOW_CALL_THRESHOLD_MS = ORIGINAL_THRESHOLD;
    }
  });

  it("uses the default of 1000 ms when SLOW_CALL_THRESHOLD_MS is not set", async () => {
    delete process.env.SLOW_CALL_THRESHOLD_MS;
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(1000);
  });

  it("uses the default of 1000 ms when SLOW_CALL_THRESHOLD_MS is an empty string", async () => {
    process.env.SLOW_CALL_THRESHOLD_MS = "";
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(1000);
  });

  it("uses the default of 1000 ms when SLOW_CALL_THRESHOLD_MS is zero", async () => {
    process.env.SLOW_CALL_THRESHOLD_MS = "0";
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(1000);
  });

  it("uses the default of 1000 ms when SLOW_CALL_THRESHOLD_MS is a negative number", async () => {
    process.env.SLOW_CALL_THRESHOLD_MS = "-500";
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(1000);
  });

  it("reads SLOW_CALL_THRESHOLD_MS from the environment variable when set to a positive value", async () => {
    process.env.SLOW_CALL_THRESHOLD_MS = "2500";
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(2500);
  });

  it("reads SLOW_CALL_THRESHOLD_MS as 500 ms when set to '500'", async () => {
    process.env.SLOW_CALL_THRESHOLD_MS = "500";
    const { SLOW_CALL_THRESHOLD_MS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_THRESHOLD_MS).toBe(500);
  });
});

describe("slow-call-config — SLOW_CALL_RETENTION_DAYS", () => {
  const ORIGINAL_RETENTION = process.env.SLOW_CALL_RETENTION_DAYS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_RETENTION === undefined) {
      delete process.env.SLOW_CALL_RETENTION_DAYS;
    } else {
      process.env.SLOW_CALL_RETENTION_DAYS = ORIGINAL_RETENTION;
    }
  });

  it("uses the default of 90 days when SLOW_CALL_RETENTION_DAYS is not set", async () => {
    delete process.env.SLOW_CALL_RETENTION_DAYS;
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(90);
  });

  it("uses the default of 90 days when SLOW_CALL_RETENTION_DAYS is an empty string", async () => {
    process.env.SLOW_CALL_RETENTION_DAYS = "";
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(90);
  });

  it("uses the default of 90 days when SLOW_CALL_RETENTION_DAYS is zero", async () => {
    process.env.SLOW_CALL_RETENTION_DAYS = "0";
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(90);
  });

  it("uses the default of 90 days when SLOW_CALL_RETENTION_DAYS is a negative number", async () => {
    process.env.SLOW_CALL_RETENTION_DAYS = "-10";
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(90);
  });

  it("reads SLOW_CALL_RETENTION_DAYS from the environment variable when set to a positive value", async () => {
    process.env.SLOW_CALL_RETENTION_DAYS = "30";
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(30);
  });

  it("reads SLOW_CALL_RETENTION_DAYS as 180 days when set to '180'", async () => {
    process.env.SLOW_CALL_RETENTION_DAYS = "180";
    const { SLOW_CALL_RETENTION_DAYS } = await import("../slow-call-config.js");
    expect(SLOW_CALL_RETENTION_DAYS).toBe(180);
  });
});
