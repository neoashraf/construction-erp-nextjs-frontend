import { apiClient } from "@/lib/api";
import {
  fetchExportCsv,
  getDeviceStatus,
  getSummaryReport,
  getSyncStatus,
  listAttendanceLogs,
  runSync,
} from "@/features/hr/api/attendance-logs";
import { describeSyncSummary } from "@/features/hr/hooks/useAttendanceLogs";
import {
  getWeeklyOffDays,
  importHolidaysFromRows,
  listGovernmentHolidays,
} from "@/features/hr/api/holidays";

jest.mock("@/lib/auth/csrf-client", () => ({ readCsrfToken: () => "csrf" }));

/**
 * Regression cover for malformed/unexpected payloads.
 *
 * The dev mock backend answers any unimplemented route with `{ data: { ok: true, path } }`,
 * so `data.data` arrives as an OBJECT. A `?? []` fallback does not catch that — the value
 * isn't nullish — and the object reached `.map`, crashing the screen. Every binding must
 * therefore validate the shape, not merely default it.
 */
const getSpy = jest.spyOn(apiClient, "get");
const postSpy = jest.spyOn(apiClient, "post");
const putSpy = jest.spyOn(apiClient, "put");

afterEach(() => jest.resetAllMocks());

/** The exact body the dev mock returns for an unimplemented route. */
const MOCK_CATCH_ALL = { ok: true, path: "/logs" };

describe("listAttendanceLogs", () => {
  it("survives the dev mock's non-array data payload", async () => {
    getSpy.mockResolvedValue({ data: MOCK_CATCH_ALL });
    const res = await listAttendanceLogs({ page: 1, limit: 20 });
    expect(res.data).toEqual([]);
    expect(() => res.data.map((r) => r.id)).not.toThrow();
  });

  it("tolerates a null body and a missing pagination block", async () => {
    getSpy.mockResolvedValue(null);
    const res = await listAttendanceLogs({ page: 3, limit: 50 });
    expect(res.data).toEqual([]);
    expect(res.pagination).toEqual({ page: 3, limit: 50, total: 0, totalPages: 1 });
  });

  it("passes a well-formed response through untouched", async () => {
    getSpy.mockResolvedValue({
      data: [{ id: "a", userId: "1", name: "R" }],
      pagination: { page: 2, limit: 10, total: 40, totalPages: 4 },
    });
    const res = await listAttendanceLogs({ page: 2, limit: 10 });
    expect(res.data).toHaveLength(1);
    expect(res.pagination.total).toBe(40);
  });
});

describe("getSummaryReport", () => {
  it("returns zeroed totals rather than undefined when the payload is junk", async () => {
    getSpy.mockResolvedValue({ data: MOCK_CATCH_ALL });
    const res = await getSummaryReport({ page: 1, limit: 25 });
    expect(res.data).toEqual([]);
    // The stat strip reads these directly — undefined would render "NaN".
    expect(res.totals.totalEmployees).toBe(0);
    expect(res.totals.attendancePercentage).toBe(0);
    expect(Math.round(res.totals.attendancePercentage)).toBe(0);
  });

  it("keeps server totals when they are present", async () => {
    getSpy.mockResolvedValue({
      data: [],
      totals: { totalEmployees: 12, presentCount: 200, attendancePercentage: 91.6 },
    });
    const res = await getSummaryReport({});
    expect(res.totals.totalEmployees).toBe(12);
    expect(res.totals.presentCount).toBe(200);
    // Unsupplied counters still fall back to zero rather than undefined.
    expect(res.totals.lateCount).toBe(0);
  });
});

describe("getDeviceStatus", () => {
  it("reads an unrecognised payload as offline", async () => {
    getSpy.mockResolvedValue({ ok: true, path: "/device/status" });
    const status = await getDeviceStatus();
    expect(status.online).toBe(false);
    expect(status.status).toBe("offline");
    expect(status.lastSeenAt).toBeNull();
  });

  it("accepts either the boolean or the status string", async () => {
    getSpy.mockResolvedValue({ online: true });
    expect((await getDeviceStatus()).status).toBe("online");
    getSpy.mockResolvedValue({ status: "online" });
    expect((await getDeviceStatus()).online).toBe(true);
  });
});

describe("sync", () => {
  it("reads a PULL response flat — these routes carry no { data } envelope", async () => {
    // The real backend body, captured from the running server against a live device.
    postSpy.mockResolvedValue({
      mode: "pull",
      users: { fetched: 55, created: 55, updated: 0, unchanged: 0, skipped: 0 },
      attendance: { fetched: 857, inserted: 857, duplicates: 0, skipped: 0 },
      unnamedUsers: 1,
      durationMs: 688,
      reconciled: 12,
      skippedReasons: {},
    });
    const summary = await runSync();
    expect(summary.mode).toBe("pull");
    expect(summary.users.created).toBe(55);
    expect(summary.attendance.inserted).toBe(857);
    expect(summary.reconciled).toBe(12);
  });

  it("folds reconcile-mode's skipped[] rows into the same reason map", async () => {
    postSpy.mockResolvedValue({
      mode: "reconcile",
      dateFrom: "2026-06-27",
      dateTo: "2026-07-26",
      days: 12,
      reconciled: 10,
      skipped: [{ reason: "NO_PROJECT" }, { reason: "NO_PROJECT" }, { reason: "NO_FINANCIAL_YEAR" }],
    });
    const summary = await runSync();
    expect(summary.mode).toBe("reconcile");
    expect(summary.skippedReasons).toEqual({ NO_PROJECT: 2, NO_FINANCIAL_YEAR: 1 });
  });

  it("zeroes malformed counters so the summary line never shows NaN", async () => {
    postSpy.mockResolvedValue({ data: MOCK_CATCH_ALL });
    const summary = await runSync();
    expect(summary.reconciled).toBe(0);
    expect(summary.users.created).toBe(0);
    expect(summary.attendance.inserted).toBe(0);
    expect(summary.skippedReasons).toEqual({});
  });

  it("reports configured + freshness and nests device status", async () => {
    getSpy.mockResolvedValue({
      syncing: false,
      configured: true,
      deviceIp: "192.168.0.200",
      devicePort: 4370,
      lastSyncAt: "2026-07-26T10:05:00.000Z",
      lastSync: null,
      device: { status: "online", online: true, lastSeenAt: "2026-07-26T10:00:00.000Z" },
      lastRecordAt: "2026-07-26T09:15:00.000Z",
      lastDeviceTimestamp: "2026-07-26 09:15:00",
    });
    const status = await getSyncStatus();
    expect(status.configured).toBe(true);
    expect(status.deviceIp).toBe("192.168.0.200");
    expect(status.device.online).toBe(true);
  });

  it("reads a junk payload as not-configured and offline", async () => {
    // Claiming "configured" here would promise a pull that cannot happen.
    getSpy.mockResolvedValue({ ok: true });
    const status = await getSyncStatus();
    expect(status.configured).toBe(false);
    expect(status.device.online).toBe(false);
    expect(status.lastRecordAt).toBeNull();
  });
});

describe("describeSyncSummary", () => {
  const base = {
    mode: "pull" as const,
    users: { fetched: 0, created: 0, updated: 0, unchanged: 0, skipped: 0 },
    attendance: { fetched: 0, inserted: 0, duplicates: 0, skipped: 0 },
    unnamedUsers: 0,
    durationMs: 0,
    reconciled: 0,
    skippedReasons: {} as Record<string, number>,
  };

  it("summarises what a pull actually changed", () => {
    expect(
      describeSyncSummary({
        ...base,
        users: { ...base.users, created: 3, updated: 2 },
        attendance: { ...base.attendance, inserted: 41 },
        reconciled: 12,
      }),
    ).toBe("3 employee(s) added · 2 name(s) updated · 41 new punch(es) · 12 day(s) reconciled");
  });

  it("leads with the blockage when punches land but nothing reaches the reports", () => {
    // The failure most easily mistaken for success — it must not read as "done".
    expect(
      describeSyncSummary({
        ...base,
        attendance: { ...base.attendance, inserted: 857 },
        reconciled: 0,
        skippedReasons: { NO_FINANCIAL_YEAR: 141 },
      }),
    ).toBe("Nothing reached the reports — 141 day(s) blocked (no financial year covers those dates)");
  });

  it("mentions blocked days alongside real progress", () => {
    expect(
      describeSyncSummary({ ...base, reconciled: 10, skippedReasons: { NO_PROJECT: 2 } }),
    ).toBe("10 day(s) reconciled · 2 day(s) blocked");
  });

  it("reads a no-op as up to date", () => {
    expect(describeSyncSummary(base)).toBe("Already up to date");
    expect(
      describeSyncSummary({ ...base, attendance: { ...base.attendance, duplicates: 857 } }),
    ).toBe("Already up to date");
  });
});

describe("fetchExportCsv", () => {
  it("rejects a JSON body instead of handing SheetJS '[object Object]'", async () => {
    getSpy.mockResolvedValue({ data: MOCK_CATCH_ALL });
    await expect(fetchExportCsv("summary", {})).rejects.toThrow(/did not return CSV/i);
  });

  it("strips the UTF-8 BOM that would corrupt the first column header", async () => {
    getSpy.mockResolvedValue("﻿User ID,Name\n1,Rahim");
    expect(await fetchExportCsv("daily", {})).toBe("User ID,Name\n1,Rahim");
  });
});

describe("holidays", () => {
  it("returns an empty weekday list for a junk payload", async () => {
    getSpy.mockResolvedValue({ ok: true, path: "/holidays/weekly" });
    expect((await getWeeklyOffDays()).weekdays).toEqual([]);
  });

  it("drops weekday values outside 0-6", async () => {
    getSpy.mockResolvedValue({ weekdays: [5, 0, 9, -1, "x"] });
    expect((await getWeeklyOffDays()).weekdays).toEqual([5, 0]);
  });

  it("returns an empty holiday list for a junk payload", async () => {
    getSpy.mockResolvedValue({ ok: true, path: "/holidays/government" });
    const list = await listGovernmentHolidays(2026);
    expect(list).toEqual([]);
    expect(() => list.map((h) => h.date)).not.toThrow();
  });

  it("drops holiday entries missing an id or date", async () => {
    getSpy.mockResolvedValue({
      holidays: [
        { id: "a", date: "2026-03-26", name: "Independence Day", source: "public" },
        { name: "no id or date" },
        null,
      ],
    });
    expect(await listGovernmentHolidays(2026)).toHaveLength(1);
  });

  it("falls back to the parsed length when importedCount is absent", async () => {
    postSpy.mockResolvedValue({
      holidays: [{ id: "a", date: "2026-01-01", name: "New Year", source: "manual" }],
    });
    expect((await importHolidaysFromRows([])).importedCount).toBe(1);
  });
});

/** Referenced so the shared put spy is initialised alongside the others. */
expect(putSpy).toBeDefined();
