import { test, expect, type Page } from "@playwright/test";

/**
 * FE-59 fe-requisition-cost-control-reports — happy path (FR-RPT-025/029).
 * Open the viewer → switch to Cost-centre variance → pick project + range →
 * Run → see status badges + Total footer → Export to Excel triggers a
 * download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Requisition & cost-control — CC variance with status + Excel export", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/reports/requisition-cost-control");
  await expect(page.getByTestId("rcc-title")).toContainText("Requisition");

  await page.getByTestId("rcc-tab-COST_CENTRE_VARIANCE").click();
  await page.getByTestId("param-project").selectOption("proj-a");
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="param-date-from"]') as HTMLInputElement)?.value === "2026-04-01",
    undefined,
    { timeout: 5000 },
  );
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("rcc-ccv-table")).toBeVisible();
  await expect(page.getByTestId("rcc-status-OVER").first()).toContainText("Over budget");
  await expect(page.getByTestId("rcc-ccv-totals-footer")).toContainText("Total");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export-excel").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
