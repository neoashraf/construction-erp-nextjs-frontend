import { test, expect, type Page } from "@playwright/test";

/**
 * FE-55 fe-financial-statements — happy path (FR-RPT-013/-014/-029). Open the
 * viewer → run P&L → see the Profit band → switch to Balance sheet → set an
 * as-of → see the balancing footer → Export to Excel triggers a download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Financial statements — P&L profit + BS balancing + Excel export", async ({ page }) => {
  await login(page);
  await page.goto("/reports/financial-statements");
  await expect(page.getByTestId("fs-title")).toContainText("Financial statements");

  // P&L run.
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("pnl-statement")).toBeVisible();
  await expect(page.getByTestId("pnl-band")).toBeVisible();

  // Switch to Balance sheet + as-of.
  await page.getByTestId("statement-tab-BS").click();
  await expect(page.getByTestId("param-as-of")).toBeVisible();
  await page.getByTestId("param-as-of").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("bs-statement")).toBeVisible();
  await expect(page.getByTestId("bs-band")).toContainText(/Balanced|Assets/);

  // Excel export (mock returns JSON; browser saves it as .xlsx).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("report-export-excel").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/balance-sheet|profit-and-loss/i);
});
