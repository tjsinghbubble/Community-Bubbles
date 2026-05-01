import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryCrashReports, mockReportFatalCrashSpike } = vi.hoisted(() => ({
  mockQueryCrashReports: vi.fn(),
  mockReportFatalCrashSpike: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    queryCrashReports: mockQueryCrashReports,
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
  });

  it("does NOT call reportFatalCrashSpike when count is zero", async () => {
    mockQueryCrashReports.mockResolvedValue([]);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });

  it("does NOT call reportFatalCrashSpike when count is one below the threshold", async () => {
    const reports = Array(DEFAULT_THRESHOLD - 1).fill({});
    mockQueryCrashReports.mockResolvedValue(reports);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });
});

describe("checkFatalCrashSpike — at or above threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls reportFatalCrashSpike when count equals the threshold", async () => {
    const reports = Array(DEFAULT_THRESHOLD).fill({});
    mockQueryCrashReports.mockResolvedValue(reports);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).toHaveBeenCalledTimes(1);
    expect(mockReportFatalCrashSpike).toHaveBeenCalledWith(
      DEFAULT_THRESHOLD,
      expect.any(Number),
      DEFAULT_THRESHOLD,
    );
  });

  it("calls reportFatalCrashSpike when count exceeds the threshold", async () => {
    const reports = Array(DEFAULT_THRESHOLD + 1).fill({});
    mockQueryCrashReports.mockResolvedValue(reports);

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).toHaveBeenCalledTimes(1);
    expect(mockReportFatalCrashSpike).toHaveBeenCalledWith(
      DEFAULT_THRESHOLD + 1,
      expect.any(Number),
      DEFAULT_THRESHOLD,
    );
  });

  it("queries crash reports with isFatal=true and a limit one above the threshold", async () => {
    mockQueryCrashReports.mockResolvedValue([]);

    await checkFatalCrashSpike();

    expect(mockQueryCrashReports).toHaveBeenCalledWith(
      expect.objectContaining({
        isFatal: true,
        limit: DEFAULT_THRESHOLD + 1,
      }),
    );
  });
});

describe("checkFatalCrashSpike — storage error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw when queryCrashReports rejects", async () => {
    mockQueryCrashReports.mockRejectedValue(new Error("DB connection failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(checkFatalCrashSpike()).resolves.toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it("logs the error to console.error when queryCrashReports rejects", async () => {
    const dbError = new Error("DB connection failed");
    mockQueryCrashReports.mockRejectedValue(dbError);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkFatalCrashSpike();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[FatalCrashSpike] Error checking for fatal crash spike:",
      dbError,
    );

    consoleErrorSpy.mockRestore();
  });

  it("does NOT call reportFatalCrashSpike when storage throws", async () => {
    mockQueryCrashReports.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await checkFatalCrashSpike();

    expect(mockReportFatalCrashSpike).not.toHaveBeenCalled();
  });
});
