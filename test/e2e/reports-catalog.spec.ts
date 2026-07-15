import { test, expect, type Page } from "@playwright/test";

/**
 * FE-54 fe-report-catalog — happy path (FR-RPT-001/-002/-029). Login → open
 * `/reports` → pick Trial balance → set a date range → Run → totals footer
 * renders → clicking Export to Excel re-issues the query and starts a download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Reports — pick Trial balance, Run, see totals, Export triggers a download", async ({ page }) => {
  await login(page);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-title")).toContainText("Reports");
  await expect(page.getByTestId("report-catalog-list")).toBeVisible();

  // Pick the Trial balance entry.
  await page.getByTestId("catalog-entry-trial-balance").click();
  await expect(page.getByTestId("report-parameter-panel")).toBeVisible();

  // Enter a date range and Run.
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("report-result")).toBeVisible();
  await expect(page.getByTestId("report-totals-footer")).toBeVisible();

  // Export to Excel — the mock returns JSON, but the browser saves it as .xlsx
  // (the assertion here is that the download event fires; correct content is
  // the RPT backend's concern).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("report-export-excel").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/trial-balance/i);
});
