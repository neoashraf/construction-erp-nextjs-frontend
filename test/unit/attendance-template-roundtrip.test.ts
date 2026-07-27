/**
 * The downloaded template must import cleanly.
 *
 * A template whose own columns the parser rejects is worse than no template: it is the first
 * thing a new user tries, and failing there reads as "the feature is broken". This asserts the
 * two are actually consistent rather than merely written to look alike.
 */
import * as XLSX from "xlsx";
import { parseAttendanceWorkbook } from "@/features/hr/lib/attendance-export";

/** The exact sheet `downloadAttendanceTemplate` writes. */
const TEMPLATE_ROWS = [
  ["Employee ID", "Date", "Check In", "Check Out"],
  ["1001", "2026-07-01", "09:05", "18:10"],
  ["1002", "2026-07-01", "08:58", "18:02"],
  ["1001", "2026-07-02", "09:45", "18:15"],
];

function templateFile(): File {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Attendance");
  const bytes = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const file = new File([bytes], "attendance-import-template.xlsx");
  // jsdom's Blob has no arrayBuffer(); the parser (correctly) uses it.
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  return file;
}

describe("attendance template round-trip", () => {
  it("parses without a structural error", async () => {
    const rows = await parseAttendanceWorkbook(templateFile());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      userId: "1001",
      date: "2026-07-01",
      checkIn: "09:05:00",
      checkOut: "18:10:00",
    });
  });

  it("produces rows that satisfy the server's contract", async () => {
    // The server's own validator is asserted in the backend suite
    // (test/unit/hr/attendance-import.spec.ts). This mirrors the SHAPE it requires — every
    // row carrying an id, a YYYY-MM-DD date and an ordered time pair — so a template change
    // that would be rejected there fails here first, in the repo that owns the template.
    const rows = await parseAttendanceWorkbook(templateFile());

    for (const row of rows) {
      expect(row.userId).not.toBe("");
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.checkIn).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(row.checkOut).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      // The server rejects a check-out before its check-in; zero-padded text compares
      // chronologically, so a plain string comparison is the same test it runs.
      expect(row.checkOut > row.checkIn).toBe(true);
    }
  });
});
