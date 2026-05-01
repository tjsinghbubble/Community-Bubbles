import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCountCrashReports, mockSetAppConfigValue, mockReportFatalCrashSpike } = vi.hoisted(() => ({
  mockCountCrashReports: vi.fn(),
  mockSetAppConfigValue: vi.fn(),
  mockReportFatalCrashSpike: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    countCrashReports: mockCountCrashReports,
    setAppConfigValue: mockSetAppConfigValue,
  },
}));

vi.mock("../sentry", () => ({
  reportFatalCrashSpike: mockReportFatalCrashSpike,
}));

import { checkFatalCrashSpike } from "../notifications.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_THRESHOLD = parsePositiveInt(process.env.FATAL_CRASH_SPIKE_THRESHOLD, 5);

describe("checkFatalCrashSpike — below threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppConfigValue.mockResolvedValue(undefined);
  });

  it("does NOT call reportFatalCrashSpike when count is zero", async () => {
    mockCountCrashReports.mockResolvedValue(0);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });

  it("does NOT call reportFatalCrashSpike when count is one below the threshold", async () => {
    mockCountCrashReports.mockResolvedValue(DEFAULT_THRESHOLD - 1);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });

  it("does NOT persist last_fatal_crash_spike_at when below threshold", async () => {
    mockCountCrashReports.mockResolvedValue(DEFAULT_THRESHOLD - 1);

    await checkFatalCrashSpike();

    expect(mockSetAppConfigValue).not.toHaveBeenCalled();
  });
});

describe("checkFatalCrashSpike — at or above threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppConfigValue.mockResolvedValue(undefined);
  });

  it("calls reportFatalCrashSpike when count equals the threshold", async () => {
    mockCountCrashReports.mockResolvedValue(DEFAULT_THRESHOLD);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).toHaveBeenCalledTimes(1);
    expect(mockReportFatalCrashSpike).toHaveBeenCalledWith(
      DEFAULT_THRESHOLD,
      expect.any(Number),
      DEFAULT_THRESHOLD,
    );
  });

  it("calls reportFatalCrashSpike when count exceeds the threshold", async () => {
    mockCountCrashReports.mockResolvedValue(DEFAULT_THRESHOLD + 10);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).toHaveBeenCalledTimes(1);
    expect(mockReportFatalCrashSpike).toHaveBeenCalledWith(
      DEFAULT_THRESHOLD + 10,
      expect.any(Number),
      DEFAULT_THRESHOLD,
    );
  });

  it("queries crash reports with isFatal=true and a from timestamp", async () => {
    mockCountCrashReports.mockResolvedValue(0);

    await checkFatalCrashSpike();

    expect(mockCountCrashReports).toHaveBeenCalledWith(
      expect.objectContaining({
        isFatal: true,
        from: expect.any(Date),
      }),
    );
  });

  it("persists last_fatal_crash_spike_at when spike is detected", async () => {
    mockCountCrashReports.mockResolvedValue(DEFAULT_THRESHOLD);

    await checkFatalCrashSpike();

    expect(mockSetAppConfigValue).toHaveBeenCalledWith(
      "last_fatal_crash_spike_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });
});

describe("checkFatalCrashSpike — storage error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppConfigValue.mockResolvedValue(undefined);
  });

  it("does not throw when countCrashReports rejects", async () => {
    mockCountCrashReports.mockRejectedValue(new Error("DB connection failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(checkFatalCrashSpike()).resolves.toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it("logs the error to console.error when countCrashReports rejects", async () => {
    const dbError = new Error("DB connection failed");
    mockCountCrashReports.mockRejectedValue(dbError);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkFatalCrashSpike();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[FatalCrashSpike] Error checking for fatal crash spike:",
      dbError,
    );

    consoleErrorSpy.mockRestore();
  });

  it("does NOT call reportFatalCrashSpike when storage throws", async () => {
    mockCountCrashReports.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });
});
