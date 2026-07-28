/**
 * Workbook → import-row parsing.
 *
 * Real `.xlsx` buffers are built with SheetJS and read back, because the failure this guards
 * against only exists in a REAL workbook: a time-formatted cell is stored as a fraction of a
 * day, so a hand-built array of strings would never reproduce it. That is the single most
 * likely way this feature could look broken while the spreadsheet looks perfect on screen.
 */
import * as XLSX from "xlsx";
import {
  AttendanceImportError,
  parseAttendanceWorkbook,
} from "@/features/hr/lib/attendance-export";

/**
 * Build a File whose bytes are a genuine xlsx workbook.
 *
 * `arrayBuffer()` is attached by hand: jsdom's Blob does not implement it, and the parser
 * (correctly) uses it. Reading via FileReader in the test instead would exercise a path the
 * app never takes.
 */
function fileFrom(bytes: ArrayBuffer, name: string): File {
  const file = new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  return file;
}

function bookBytes(sheet: XLSX.WorkSheet): ArrayBuffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Attendance");
  return XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function workbookFile(rows: unknown[][], name = "attendance.xlsx"): File {
  return fileFrom(bookBytes(XLSX.utils.aoa_to_sheet(rows)), name);
}

const HEADER = ["Employee ID", "Date", "Check In", "Check Out"];

describe("parseAttendanceWorkbook", () => {
  it("reads a plain text sheet", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["1001", "2026-07-01", "09:05", "18:10"]]),
    );

    expect(rows).toEqual([
      { userId: "1001", date: "2026-07-01", checkIn: "09:05:00", checkOut: "18:10:00" },
    ]);
  });

  it("converts a real Excel time cell, not the fraction it is stored as", async () => {
    // 09:30 is stored as 0.395833…; reading it as text would post that number to the server
    // and every row would come back rejected as an invalid time.
    const sheet = XLSX.utils.aoa_to_sheet([HEADER, ["1001", "2026-07-01", null, null]]);
    sheet.C2 = { t: "n", v: 9.5 / 24, z: "hh:mm" };
    sheet.D2 = { t: "n", v: 18.25 / 24, z: "hh:mm" };
    const rows = await parseAttendanceWorkbook(fileFrom(bookBytes(sheet), "a.xlsx"));

    expect(rows[0]?.checkIn).toBe("09:30:00");
    expect(rows[0]?.checkOut).toBe("18:15:00");
  });

  it("rounds a binary-approximated time to the nearest second", async () => {
    // 09:05 as a fraction is not exact; truncating would yield 09:04:59.
    const sheet = XLSX.utils.aoa_to_sheet([HEADER, ["1001", "2026-07-01", null, null]]);
    sheet.C2 = { t: "n", v: (9 * 3600 + 5 * 60) / 86400, z: "hh:mm" };
    const rows = await parseAttendanceWorkbook(fileFrom(bookBytes(sheet), "a.xlsx"));
    expect(rows[0]?.checkIn).toBe("09:05:00");
  });

  it("keeps only the time-of-day from a date+time cell", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([HEADER, ["1001", "2026-07-01", null, null]]);
    // A whole-day part plus 09:30.
    sheet.C2 = { t: "n", v: 46204 + 9.5 / 24, z: "yyyy-mm-dd hh:mm" };
    const rows = await parseAttendanceWorkbook(fileFrom(bookBytes(sheet), "a.xlsx"));
    expect(rows[0]?.checkIn).toBe("09:30:00");
  });

  it("reads 12-hour text with a meridiem", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["1001", "2026-07-01", "9:05 AM", "6:10 PM"]]),
    );
    expect(rows[0]?.checkIn).toBe("09:05:00");
    expect(rows[0]?.checkOut).toBe("18:10:00");
  });

  it("handles 12 AM and 12 PM, where naive modulo maths goes wrong", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["1001", "2026-07-01", "12:15 AM", "12:30 PM"]]),
    );
    expect(rows[0]?.checkIn).toBe("00:15:00");
    expect(rows[0]?.checkOut).toBe("12:30:00");
  });

  it("normalises an Excel date cell to YYYY-MM-DD", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["1001", new Date(2026, 6, 1), "09:05", "18:10"]]),
    );
    expect(rows[0]?.date).toBe("2026-07-01");
  });

  it("accepts alternative column names", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([
        ["Employee Code", "Attendance Date", "In Time", "Out Time"],
        ["1001", "2026-07-01", "09:05", "18:10"],
      ]),
    );
    expect(rows[0]).toEqual({
      userId: "1001",
      date: "2026-07-01",
      checkIn: "09:05:00",
      checkOut: "18:10:00",
    });
  });

  it("passes an unrecognised time through for the server to judge", async () => {
    // Dropping it here would silently lose the row without ever naming it.
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["1001", "2026-07-01", "half nine", ""]]),
    );
    expect(rows[0]?.checkIn).toBe("half nine");
  });

  it("names the missing column rather than yielding blank rows", async () => {
    // Without the header check the server reports "row 2, row 3… Employee ID is required",
    // which hides the real problem: the header row is wrong.
    await expect(
      parseAttendanceWorkbook(
        workbookFile([["Name", "When", "In", "Out"], ["Rahim", "2026-07-01", "09:05", "18:10"]]),
      ),
    ).rejects.toThrow(/Employee ID/);
  });

  it("rejects a sheet with no data rows", async () => {
    await expect(parseAttendanceWorkbook(workbookFile([HEADER]))).rejects.toBeInstanceOf(
      AttendanceImportError,
    );
  });

  it("keeps blank cells as empty strings so the server can report the row", async () => {
    const rows = await parseAttendanceWorkbook(
      workbookFile([HEADER, ["", "", "", ""], ["1001", "2026-07-01", "09:05", ""]]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ userId: "", date: "", checkIn: "", checkOut: "" });
    expect(rows[1]?.checkOut).toBe("");
  });
});
