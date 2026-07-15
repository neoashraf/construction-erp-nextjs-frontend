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
  await expect(page.getByTestId("hr-title")).toContainText("HR reports");
  await expect(page.getByTestId("hr-readonly-pill")).toContainText("Read-only");

  await page.getByTestId("hr-filter-run").selectOption("run-1");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("hr-sr-table")).toBeVisible();
  await expect(page.getByTestId("hr-sr-totals-footer")).toContainText(/Gross/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export-excel").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
