/**
 * FE-36 biometric import file parsing (FR-HR-004). Regression for the bug where an uploaded
 * .xlsx was read as raw text and fed straight to JSON.parse — producing the "Paste a JSON
 * array of rows or drop a CSV/XLSX file." error. The panel now parses CSV/XLSX/JSON into
 * OfficeAttendanceRow[] before importing.
 */
import * as XLSX from "xlsx";
import { parseAttendanceFeed } from "@/features/hr/lib/parseAttendanceFeed";

// jsdom's File in this jest env lacks .text()/.arrayBuffer() (real browsers provide them),
// so we hand the parser a minimal File-like with those two methods implemented.
function fileFrom(name: string, data: Uint8Array | ArrayBuffer | string): File {
  const isString = typeof data === "string";
  return {
    name,
    async text() {
      if (isString) return data;
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      return Buffer.from(bytes).toString("utf8");
    },
    async arrayBuffer() {
      if (isString) return new TextEncoder().encode(data).buffer;
      return data instanceof Uint8Array ? data.buffer : data;
    },
  } as unknown as File;
}

describe("parseAttendanceFeed", () => {
  it("parses a real .xlsx workbook into rows (the reported bug)", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Employee ID", "Date", "Project", "Time In", "Time Out", "Status"],
      ["emp-1", "13/07/2026", "proj-a", "09:02", "17:58", "P"],
      ["emp-2", "13/07/2026", "proj-a", "", "", "A"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    const rows = await parseAttendanceFeed(fileFrom("zkteco-log.xlsx", buffer));

    expect(rows).toEqual([
      {
        employeeId: "emp-1",
        attendanceDate: "2026-07-13",
        projectId: "proj-a",
        dayStatus: "PRESENT",
        checkIn: "09:02",
        checkOut: "17:58",
        overtimeHours: null,
      },
      {
        employeeId: "emp-2",
        attendanceDate: "2026-07-13",
        projectId: "proj-a",
        dayStatus: "ABSENT",
        checkIn: null,
        checkOut: null,
        overtimeHours: null,
      },
    ]);
  });

  it("parses CSV with a header row", async () => {
    const csv = "employeeId,attendanceDate,projectId,dayStatus\nemp-3,2026-07-14,proj-b,PRESENT";
    const rows = await parseAttendanceFeed(fileFrom("log.csv", csv));
    expect(rows).toEqual([
      {
        employeeId: "emp-3",
        attendanceDate: "2026-07-14",
        projectId: "proj-b",
        dayStatus: "PRESENT",
        checkIn: null,
        checkOut: null,
        overtimeHours: null,
      },
    ]);
  });

  it("defaults dayStatus to PRESENT when a punch exists but no status column", async () => {
    const csv = "Employee ID,Date,In,Out\nemp-9,15/07/2026,08:55,18:10";
    const rows = await parseAttendanceFeed(fileFrom("punches.csv", csv));
    expect(rows[0]).toMatchObject({ employeeId: "emp-9", dayStatus: "PRESENT", checkIn: "08:55" });
  });

  it("passes a JSON array through unchanged", async () => {
    const feed = [{ employeeId: "emp-1", attendanceDate: "2026-07-13", projectId: "proj-a", dayStatus: "PRESENT" }];
    const rows = await parseAttendanceFeed(fileFrom("feed.json", JSON.stringify(feed)));
    expect(rows).toEqual(feed);
  });

  it("throws a friendly error when the employee/date columns are missing", async () => {
    const csv = "name,hours\nAshraf,8";
    await expect(parseAttendanceFeed(fileFrom("bad.csv", csv))).rejects.toThrow(/employee and date/i);
  });

  it("rejects an unsupported file type", async () => {
    await expect(parseAttendanceFeed(fileFrom("photo.png", "x"))).rejects.toThrow(/Unsupported file type/i);
  });
});
