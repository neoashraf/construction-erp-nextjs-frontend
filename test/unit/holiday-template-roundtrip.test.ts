/**
 * The downloaded holiday template must import cleanly (API contract 12 § Holidays,
 * template-coupling note).
 *
 * A template whose own columns the parser rejects is worse than no template: it is the
 * first thing a user tries, and failing there reads as "the import is broken". This
 * asserts the generator and `parseHolidayWorkbook` are actually consistent rather than
 * merely written to look alike — if either changes, change both.
 */
import * as XLSX from "xlsx";
import { HolidayImportError, parseHolidayWorkbook } from "@/features/hr/lib/attendance-export";

/**
 * The exact sheet `downloadHolidayTemplate` writes. Kept literally in step with the
 * generator: the seeded rows carry REAL Bangla so the file demonstrates both the shape
 * and the encoding (CLAUDE.md Bangla/UTF-8).
 */
const TEMPLATE_ROWS = [
  ["Date", "Holiday Name", "Local Name"],
  ["2026-02-21", "International Mother Language Day", "আন্তর্জাতিক মাতৃভাষা দিবস"],
  ["2026-03-26", "Independence Day", "স্বাধীনতা দিবস"],
];

function templateFile(rows: unknown[][] = TEMPLATE_ROWS): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Holidays");
  const bytes = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const file = new File([bytes], "holiday-import-template.xlsx");
  // jsdom's Blob has no arrayBuffer(); the parser (correctly) uses it.
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  return file;
}

describe("holiday template round-trip", () => {
  it("parses the template's own rows without a structural error", async () => {
    const rows = await parseHolidayWorkbook(templateFile());
    expect(rows).toEqual([
      {
        date: "2026-02-21",
        name: "International Mother Language Day",
        localName: "আন্তর্জাতিক মাতৃভাষা দিবস",
      },
      { date: "2026-03-26", name: "Independence Day", localName: "স্বাধীনতা দিবস" },
    ]);
  });

  it("keeps the Bangla localName byte-intact through the workbook", async () => {
    const rows = await parseHolidayWorkbook(templateFile());
    expect(rows[0]!.localName).toBe("আন্তর্জাতিক মাতৃভাষা দিবস");
  });

  it("accepts the documented header aliases, case- and separator-insensitively", async () => {
    const rows = await parseHolidayWorkbook(
      templateFile([
        ["holiday_date", "Title", "local name"],
        ["2026-04-14", "Bengali New Year", "পহেলা বৈশাখ"],
      ]),
    );
    expect(rows).toEqual([
      { date: "2026-04-14", name: "Bengali New Year", localName: "পহেলা বৈশাখ" },
    ]);
  });

  it("produces rows that satisfy the server's contract shape", async () => {
    const rows = await parseHolidayWorkbook(templateFile());
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.name).not.toBe("");
    }
  });

  it("fails the whole file with a row-numbered message when a row has a date but no name", async () => {
    await expect(
      parseHolidayWorkbook(
        templateFile([
          ["Date", "Holiday Name", "Local Name"],
          ["2026-02-21", "International Mother Language Day", ""],
          ["2026-03-26", "", ""],
        ]),
      ),
    ).rejects.toThrow(HolidayImportError);
    await expect(
      parseHolidayWorkbook(
        templateFile([
          ["Date", "Holiday Name"],
          ["2026-02-21", "Ok"],
          ["2026-03-26", ""],
        ]),
      ),
    ).rejects.toThrow(/Row 2 is missing a valid date or holiday name/);
  });

  it("skips fully blank filler rows silently", async () => {
    const rows = await parseHolidayWorkbook(
      templateFile([
        ["Date", "Holiday Name", "Local Name"],
        ["2026-02-21", "Shaheed Day", ""],
        ["", "", ""],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: "2026-02-21", name: "Shaheed Day", localName: null });
  });
});
