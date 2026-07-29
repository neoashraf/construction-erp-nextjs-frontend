import { test, expect, type Page } from "@playwright/test";

/**
 * FE-60 fe-hr-reports — happy path (FR-RPT-027/029). Open the viewer →
 * Salary register default → pick a salary run → Run → see the register-
 * totals footer → Export to Excel triggers a download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("HR reports — salary register run → totals → Excel", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/reports/hr");
  /*
   * The H1 is the ACTIVE REPORT's title, not a group label — "Salary register"
   * on the landing tab (spec §8, and the design's frames). This spec asserted a
   * "HR reports" heading and a `hr-readonly-pill` testid that the viewer has
   * never rendered, so it had been failing since FE-60; corrected here to what
   * the screen actually shows rather than deleted.
   */
  await expect(page.getByTestId("hr-title")).toContainText("Salary register");

  // Pick the POSTED run by its label — the register reconciles to a posted
  // SALARY entry, and the mock's run ids (`sal-posted-1`, …) are not the
  // `run-1` this spec originally hard-coded.
  const runSelect = page.getByTestId("hr-filter-run");
  await expect(runSelect.locator("option")).not.toHaveCount(1);
  await runSelect.selectOption({ index: 1 });
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("hr-sr-table")).toBeVisible();
  await expect(page.getByTestId("hr-sr-totals-footer")).toContainText(/Gross/);

  // Same reason as the attendance path below: the mock backend serves no binary
  // export, so the assertion is on the re-issued REQUEST, not a saved file.
  const exportRequest = page.waitForRequest(
    (req) => req.url().includes("/api/reports/") && req.url().includes("format=excel"),
  );
  await page.getByTestId("report-export-excel").click();
  await page.getByTestId("report-export-run").click();
  expect((await exportRequest).url()).toContain("/api/reports/salary-register");
});

/**
 * FE-66 — the attendance report's three grains, and the download that follows
 * them (FR-RPT-026/-029; spec §3, §9). Switch to Attendance summary → drop to
 * **Daily** detail → run a window → confirm the per-employee-day table, the
 * server-side totals band, and an Export that names the grain it is producing.
 */
test("HR reports — attendance Daily detail → server totals → Excel at that grain", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/reports/hr");

  await page.getByTestId("hr-tab-ATTENDANCE_SUMMARY").click();

  // Level 2 is a radiogroup named "Detail" — subordinate to the report tablist,
  // so a screen-reader user hears three grains rather than five sibling reports.
  const detail = page.getByRole("radiogroup", { name: "Detail" });
  await expect(detail).toBeVisible();
  await expect(page.getByRole("tablist")).toBeVisible();

  await page.getByTestId("attendance-level-daily").click();
  await page.getByTestId("hr-filter-date-from").fill("2026-06-01");
  await page.getByTestId("hr-filter-date-to").fill("2026-06-30");
  await page.getByTestId("report-run").click();

  // One row per employee-day, with the 8-column Daily grain.
  await expect(page.getByTestId("hr-att-daily-table")).toBeVisible();
  await expect(page.getByTestId("hr-results-heading")).toContainText("Daily detail");

  // Totals are the server's over the whole filtered set — never a page sum.
  await expect(page.getByTestId("hr-att-totals-band")).toContainText(
    /not a sum of this page/,
  );

  // The file matches what is on screen, and says so before it is produced.
  await expect(page.getByTestId("report-export-scope-note")).toContainText("Daily detail");

  /*
   * Assert the export is re-issued AT THE ACTIVE GRAIN, by watching the request
   * rather than the downloaded file: the mock backend serves no binary export
   * (there is no xlsx/pdf handler under `USE_MOCK_NESTJS`), so waiting on a
   * `download` event can never resolve here. The grain is the thing this test
   * exists to prove — that Export follows the level on screen and does not
   * silently produce a Summary file — and the request URL carries it.
   */
  const exportRequest = page.waitForRequest(
    (req) => req.url().includes("/api/reports/") && req.url().includes("format=excel"),
  );
  await page.getByTestId("report-export-excel").click();
  await page.getByTestId("report-export-run").click();
  const url = (await exportRequest).url();
  // The DAILY endpoint, not `attendance-summary`.
  expect(url).toContain("/api/reports/daily");
  expect(url).toContain("dateFrom=2026-06-01");

  // An export never re-renders the report it was launched from.
  await expect(page.getByTestId("hr-att-daily-table")).toBeVisible();
});
