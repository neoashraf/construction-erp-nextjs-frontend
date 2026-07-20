/**
 * FE-36 biometric import file parsing (FR-HR-004). Regression for the bugs where (a) an
 * uploaded .xlsx was read as raw text and fed to JSON.parse, and (b) the parsed rows carried
 * a per-row projectId/employeeId instead of the backend's employeeCode-keyed BiometricFeedRow
 * (project is applied top-level by the panel). Output must match the real backend deviceFeed.
 */
import * as XLSX from "xlsx";
import { parseAttendanceFeed } from "@/features/hr/lib/parseAttendanceFeed";

function fileFrom(name: string, data: Uint8Array | ArrayBuffer | string): File {
  // jsdom's File in this jest env lacks .text()/.arrayBuffer() — provide minimal versions.
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
  it("parses a real .xlsx export matching the reported sheet columns", async () => {
    // Columns exactly as in the user's sheet: Employee | Name | Date | Checkin Time | Checkout Time | Status
    const ws = XLSX.utils.aoa_to_sheet([
      ["Employee", "Name", "Date", "Checkin Time", "Checkout Time", "Status"],
      ["1", "A.B.M. Shah", "2026-06-01", "9:47:00 AM", "6:50:15 PM", "Late"],
      ["1", "A.B.M. Shah", "2026-06-05", "", "", "Holiday"],
      ["1", "A.B.M. Shah", "2026-06-09", "", "", "Absent"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    const rows = await parseAttendanceFeed(fileFrom("biometric.xlsx", buffer));

    expect(rows).toEqual([
      { employeeCode: "1", attendanceDate: "2026-06-01", checkIn: "09:47", checkOut: "18:50", dayStatus: "PRESENT", overtimeHours: null },
      { employeeCode: "1", attendanceDate: "2026-06-05", checkIn: null, checkOut: null, dayStatus: "PAID_LEAVE", overtimeHours: null },
      { employeeCode: "1", attendanceDate: "2026-06-09", checkIn: null, checkOut: null, dayStatus: "ABSENT", overtimeHours: null },
    ]);
  });

  it("carries no per-row projectId or employeeId (project is applied top-level)", async () => {
    const csv = "Employee,Date,Status\n7,2026-06-01,Late";
    const rows = await parseAttendanceFeed(fileFrom("log.csv", csv));
    expect(rows[0]).toEqual({
      employeeCode: "7",
      attendanceDate: "2026-06-01",
      checkIn: null,
      checkOut: null,
      dayStatus: "PRESENT",
      overtimeHours: null,
    });
    expect(rows[0]).not.toHaveProperty("projectId");
    expect(rows[0]).not.toHaveProperty("employeeId");
  });

  it("normalises DD/MM/YYYY dates and 24h times", async () => {
    const csv = "Employee ID,Date,In,Out\n9,15/06/2026,08:55,18:10";
    const rows = await parseAttendanceFeed(fileFrom("punches.csv", csv));
    expect(rows[0]).toMatchObject({
      employeeCode: "9",
      attendanceDate: "2026-06-15",
      checkIn: "08:55",
      checkOut: "18:10",
      dayStatus: null, // no status column → backend defaults to PRESENT
    });
  });

  it("leaves dayStatus null when there is no status column", async () => {
    const csv = "Employee,Date\n3,2026-06-02";
    const rows = await parseAttendanceFeed(fileFrom("f.csv", csv));
    expect(rows[0]!.dayStatus).toBeNull();
  });

  it("passes a JSON array through unchanged", async () => {
    const feed = [{ employeeCode: "1", attendanceDate: "2026-06-01", dayStatus: "PRESENT" }];
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
