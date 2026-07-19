import { test, expect, type Page } from "@playwright/test";

/**
 * FE-54 fe-report-catalog — happy path (FR-RPT-001/-002/-029). Login → open
 * `/reports` → pick Trial balance from the catalog → its viewer opens INLINE on
 * the hub → set the as-of date → Run → the trial-balance table renders → Export
 * to Excel re-issues the query and starts a download. (Picking a report no longer
 * navigates to a separate page — the runner is embedded in the hub.)
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Reports — pick Trial balance, Run inline, see the table, Export triggers a download", async ({ page }) => {
  await login(page);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-title")).toContainText("Reports");
  await expect(page.getByTestId("report-catalog-browse")).toBeVisible();

  // Pick the Trial balance chip — its viewer mounts inline (no navigation).
  await page.getByTestId("catalog-chip-trial-balance").click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByTestId("report-parameter-panel")).toBeVisible();

  // Trial balance is an as-of report — set the as-of date and Run.
  await page.getByTestId("param-as-of").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("tb-table")).toBeVisible();

  // Export to Excel — the download event should fire.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("report-export-excel").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/trial-balance/i);
});
