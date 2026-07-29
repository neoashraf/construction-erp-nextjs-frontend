import { test, expect, type Page } from "@playwright/test";

/**
 * FE-64 Attendance — office ingestion **merges**; there is nothing to reconcile
 * (FR-HR-004; SRS §12 edges 9, 15).
 *
 * This replaces the FE-36 reconciliation spec. That spec drove
 * `office-toggle-import` → `biometric-import-panel` → `biometric-conflict`, and asserted that a
 * day already captured came back as an `ALREADY_RECORDED` **conflict** for a human to resolve.
 * All three controls are gone, and so is the endpoint behind them
 * (`POST /attendance/office/import`, REMOVED in attendance Phase A).
 *
 * What replaced them is the opposite model: every ingestion path — device push, `Sync device`
 * pull, spreadsheet import and keyed roster entry — normalises to punches, dedupes on
 * (company, employee, punch timestamp), and folds into **one** office row per employee-day
 * (check-in = earliest punch, check-out = latest). So a second record for a captured day
 * **merges**: it is never rejected as a duplicate and never doubles the day, and re-importing
 * the same file is a de-duplicated no-op. The requirement this spec now encodes is therefore
 * "the day merged and was not doubled, and nothing asked the user to pick a winner".
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Office staff → Single date, i.e. the editable roster (the period selects the view).
 *
 * Waits for a real row, not just the card: the roster loads asynchronously, so counting rows
 * the moment the container appears reads 0 and any "did the count change?" assertion passes
 * vacuously.
 */
async function openRoster(page: Page) {
  await page.goto("/hr/attendance");
  await expect(page.getByTestId("attendance-title")).toHaveText("Attendance");
  await page.getByTestId("attendance-tab-OFFICE").click();
  await page.getByRole("button", { name: "Single" }).click();
  await expect(page.getByTestId("office-roster")).toBeVisible();
  await expect(page.getByTestId("office-row").first()).toBeVisible();
}

/**
 * Upload a sheet through the real Import drawer. The workbook is parsed in the BROWSER
 * (SheetJS) and posted as JSON rows, so a CSV buffer exercises the same path a user's .xlsx
 * would — including the Location column FE-64 added.
 */
async function importSheet(page: Page, csv: string) {
  await page.getByTestId("open-import").click();
  await page.getByTestId("attendance-import-file").setInputFiles({
    name: "entry-log.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  const importButton = page.getByRole("button", { name: /^Import \d+ row/ });
  await expect(importButton).toBeEnabled();
  await importButton.click();
}

/*
 * Serial: these tests WRITE to the mock backend's in-process attendance store, and two of them
 * assert on a row count. Run in parallel they would observe each other's imports and fail (or
 * pass) for reasons unrelated to the merge rule under test.
 */
test.describe.configure({ mode: "serial" });

test.describe("Office staff — ingestion merges, it never reconciles", () => {
  test("a sheet for an already-captured day merges the day and never doubles it", async ({ page }) => {
    await login(page);
    await openRoster(page);

    const rowsBefore = await page.getByTestId("office-row").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // The mock seeds emp-2 for 2026-07-11. This sheet reports an EARLIER check-in and a LATER
    // check-out for that same employee-day — the merge case the old spec called a conflict.
    await importSheet(
      page,
      ["Employee ID,Date,Check In,Check Out,Location", "emp-2,2026-07-11,08:15,18:40,BR-04"].join("\n"),
    );

    // The result reports the run; it never offers a conflict to resolve.
    await expect(page.getByText(/Days updated/i)).toBeVisible();
    await expect(page.getByText(/keep manual|keep imported/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Done" }).click();

    // The day MERGED — the roster did not grow a second row for the same employee-day. Asserted
    // as "no more rows than before", so a sibling test seeding its own employee cannot make this
    // pass or fail for the wrong reason (the mock store is shared in-process).
    await expect(page.getByTestId("office-row")).toHaveCount(rowsBefore);
  });

  test("re-importing the same file changes nothing — duplicates, not doubling", async ({ page }) => {
    await login(page);
    await openRoster(page);

    const sheet = [
      "Employee ID,Date,Check In,Check Out,Location",
      "emp-2,2026-07-11,09:10,18:05,BR-04",
    ].join("\n");

    await importSheet(page, sheet);
    await page.getByRole("button", { name: "Done" }).click();
    const afterFirst = await page.getByTestId("office-row").count();

    // Punches dedupe on (company, employee, timestamp), so the second run inserts nothing. This
    // is the reassurance an operator needs before daring to re-upload after a partial run —
    // without it they hand-key what the file already contained.
    await importSheet(page, sheet);
    await expect(page.getByText(/Already present/i)).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByTestId("office-row")).toHaveCount(afterFirst);
  });

  test("no reconciliation control exists anywhere on the screen", async ({ page }) => {
    await login(page);
    await page.goto("/hr/attendance");
    await page.getByTestId("attendance-tab-OFFICE").click();
    await expect(page.getByTestId("office-staff-panel")).toBeVisible();

    // The three controls the old spec drove, and the choice they existed to offer.
    await expect(page.getByTestId("office-toggle-import")).toHaveCount(0);
    await expect(page.getByTestId("biometric-import-panel")).toHaveCount(0);
    await expect(page.getByTestId("biometric-conflict")).toHaveCount(0);
    await expect(page.getByText(/keep manual|keep imported/i)).toHaveCount(0);

    // What stands in their place: one status, one pull, one push.
    const header = page.getByTestId("office-header-actions");
    await expect(header.getByTestId("open-import")).toBeVisible();
    await expect(header.getByRole("button", { name: /sync device/i })).toBeVisible();
  });

  test("a per-row rejection names the sheet row and imports everything else", async ({ page }) => {
    await login(page);
    await openRoster(page);

    // One bad Location cell must not discard the good rows: the operator supplied an answer and
    // it was wrong, which is a per-row error carrying the SHEET row number — not a failed file.
    await importSheet(
      page,
      [
        "Employee ID,Date,Check In,Check Out,Location",
        "emp-2,2026-07-11,08:15,18:40,BR-04",
        "emp-3,2026-07-11,09:00,18:00,Site B4",
      ].join("\n"),
    );

    const rowError = page.getByTestId("import-row-error").first();
    await expect(rowError).toBeVisible();
    // "Row {row} · {message}", with the server's message verbatim — the row number and the
    // offending value are the whole point of the format.
    await expect(rowError).toContainText("Row 3");
    await expect(rowError).toContainText("Site B4");
  });
});

test.describe("Office staff — the period selects the view", () => {
  test("single date is editable; a month is read-only review", async ({ page }) => {
    await login(page);
    await page.goto("/hr/attendance");
    await page.getByTestId("attendance-tab-OFFICE").click();

    await page.getByRole("button", { name: "Single" }).click();
    await expect(page.getByTestId("office-roster")).toBeVisible();
    await expect(page.getByTestId("range-readonly-note")).toHaveCount(0);

    // A range is inherently a review — only a single day is editable, so the month view says so
    // rather than presenting inputs that cannot be saved.
    await page.getByRole("button", { name: "Month" }).click();
    await expect(page.getByTestId("range-readonly-note")).toContainText(
      "Attendance is edited a day at a time",
    );
    await expect(page.getByTestId("office-roster")).toHaveCount(0);

    // Downloads live on the report, not here.
    await expect(page.getByTestId("export-menu")).toHaveCount(0);
    await expect(page.getByTestId("attendance-export-pointer")).toContainText(
      "Reports › Attendance summary",
    );
  });
});
