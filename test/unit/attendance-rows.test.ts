import {
  hueFor,
  initialsFor,
  mapLogEntry,
  mapSummaryRow,
  statusLabel,
  statusTone,
} from "@/features/hr/lib/attendance-rows";
import {
  filtersForExport,
  pageItems,
  toRequestFilters,
  type FilterDraft,
} from "@/features/hr/lib/attendance-filters";
import { type LogEntry, type SummaryReportRow } from "@/features/hr/api/attendance-logs";

function logEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "row-1",
    userId: "7",
    name: "Rahim Uddin",
    deviceTimestamp: null,
    occurredAt: null,
    receivedAt: null,
    status: null,
    sourceType: null,
    ...overrides,
  };
}

describe("mapLogEntry fallbacks", () => {
  it("reconstructs workingDays from present + absent when the server omits it", () => {
    const row = mapLogEntry(logEntry({ presentCount: 18, absentCount: 2 }));
    expect(row.workingDays).toBe(20);
  });

  it("prefers the server's percentage over recomputing it", () => {
    const row = mapLogEntry(
      logEntry({ presentCount: 18, absentCount: 2, attendancePercentage: 87.4 }),
    );
    expect(row.attendancePercent).toBe(87);
  });

  it("computes a percentage only when the server gives none", () => {
    const row = mapLogEntry(logEntry({ presentCount: 9, absentCount: 1 }));
    expect(row.attendancePercent).toBe(90);
  });

  it("never divides by zero when there are no working days", () => {
    expect(mapLogEntry(logEntry()).attendancePercent).toBe(0);
  });

  it("counts holidays from the day records when holidayCount is absent", () => {
    const row = mapLogEntry(
      logEntry({
        attendanceRecords: [
          { id: "a", deviceTimestamp: null, occurredAt: null, receivedAt: null, status: "Holiday" },
          { id: "b", deviceTimestamp: null, occurredAt: null, receivedAt: null, holidayName: "Eid" },
          { id: "c", deviceTimestamp: null, occurredAt: null, receivedAt: null, status: "Present" },
        ],
      }),
    );
    expect(row.holidayCount).toBe(2);
  });

  it("walks the check-in fallback chain in priority order", () => {
    expect(mapLogEntry(logEntry({ occurredAt: "A", deviceTimestamp: "B", receivedAt: "C" })).checkIn).toBe("A");
    expect(mapLogEntry(logEntry({ deviceTimestamp: "B", receivedAt: "C" })).checkIn).toBe("B");
    expect(mapLogEntry(logEntry({ receivedAt: "C" })).checkIn).toBe("C");
    expect(mapLogEntry(logEntry()).checkIn).toBeNull();
  });

  it("falls back to the first record's status, then Absent", () => {
    expect(mapLogEntry(logEntry({ status: "Late" })).status).toBe("Late");
    expect(
      mapLogEntry(
        logEntry({
          attendanceRecords: [
            { id: "a", deviceTimestamp: null, occurredAt: null, receivedAt: null, status: "Present" },
          ],
        }),
      ).status,
    ).toBe("Present");
    expect(mapLogEntry(logEntry()).status).toBe("Absent");
  });
});

describe("mapSummaryRow", () => {
  const base: SummaryReportRow = {
    id: "s1",
    userId: "7",
    name: "Rahim",
    designation: null,
    workingDays: 22,
    onTimeCount: 20,
    lateCount: 1,
    presentCount: 21,
    absentCount: 1,
    holidayCount: 4,
    attendancePercentage: 95.5,
  };

  it("derives status from the absent count and carries no per-day records", () => {
    expect(mapSummaryRow(base).status).toBe("Absent");
    expect(mapSummaryRow({ ...base, absentCount: 0 }).status).toBe("Present");
    expect(mapSummaryRow(base).records).toEqual([]);
    expect(mapSummaryRow(base).checkIn).toBeNull();
  });
});

describe("avatar identity", () => {
  it("takes the initials of the first two words", () => {
    expect(initialsFor("Rahim Uddin Ahmed", "7")).toBe("RU");
    expect(initialsFor("Rahim", "7")).toBe("R");
  });

  it("falls back to the userId when there is no usable name", () => {
    expect(initialsFor(null, "42")).toBe("42");
    expect(initialsFor("   ", "42")).toBe("42");
  });

  it("spreads short sequential ids across the colour wheel", () => {
    // The golden-angle step is the point: without it "1".."8" cluster in one hue band.
    const hues = ["1", "2", "3", "4", "5", "6", "7", "8"].map(hueFor);
    expect(new Set(hues).size).toBe(hues.length);
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeGreaterThan(180);
  });

  it("is stable for the same id", () => {
    expect(hueFor("12345")).toBe(hueFor("12345"));
  });
});

describe("status presentation", () => {
  it("maps known statuses and defaults the rest to Absent", () => {
    expect(statusTone("Present")).toBe("success");
    expect(statusTone("Late")).toBe("warning");
    expect(statusTone("Holiday")).toBe("info");
    expect(statusTone("Absent")).toBe("destructive");
    expect(statusTone("something-else")).toBe("destructive");
    expect(statusLabel(null)).toBe("Absent");
  });
});

describe("toRequestFilters", () => {
  const draft: FilterDraft = {
    mode: "range",
    search: "",
    date: "2026-07-03",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    summary: false,
  };

  it("routes an all-digit term to userId and anything else to name", () => {
    expect(toRequestFilters({ ...draft, search: "1024" }).userId).toBe("1024");
    expect(toRequestFilters({ ...draft, search: "1024" }).name).toBeUndefined();
    expect(toRequestFilters({ ...draft, search: "Rahim" }).name).toBe("Rahim");
  });

  it("trims and omits an empty search entirely", () => {
    expect(toRequestFilters({ ...draft, search: "  Rahim  " }).name).toBe("Rahim");
    const empty = toRequestFilters({ ...draft, search: "   " });
    expect(empty.name).toBeUndefined();
    expect(empty.userId).toBeUndefined();
  });

  it("sends only the dates the active mode uses", () => {
    const single = toRequestFilters({ ...draft, mode: "single" });
    expect(single.date).toBe("2026-07-03");
    expect(single.dateFrom).toBeUndefined();

    const range = toRequestFilters(draft);
    expect(range.dateFrom).toBe("2026-07-01");
    expect(range.date).toBeUndefined();
  });
});

describe("filtersForExport", () => {
  it("widens a single day into a one-day range", () => {
    expect(filtersForExport("range", { date: "2026-07-03" })).toEqual({
      dateFrom: "2026-07-03",
      dateTo: "2026-07-03",
    });
  });

  it("narrows a range to its first date for a daily export", () => {
    expect(filtersForExport("daily", { dateFrom: "2026-07-01", dateTo: "2026-07-31" })).toEqual({
      date: "2026-07-01",
    });
  });

  it("squares off a half-open range, which the reports API rejects", () => {
    expect(filtersForExport("summary", { dateFrom: "2026-07-01" })).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
    });
    expect(filtersForExport("summary", { dateTo: "2026-07-31" })).toEqual({
      dateFrom: "2026-07-31",
      dateTo: "2026-07-31",
    });
  });

  it("preserves the employee filter across the translation", () => {
    expect(filtersForExport("range", { userId: "7", date: "2026-07-03" }).userId).toBe("7");
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds a leading gap past page 3 and a trailing gap before the end", () => {
    expect(pageItems(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageItems(2, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageItems(19, 20)).toEqual([1, null, 18, 19, 20]);
  });
});
