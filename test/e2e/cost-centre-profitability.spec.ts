import { test, expect, type Page } from "@playwright/test";

/**
 * FE-26 cost-centre profitability happy path (FR-CC-009): load → switch grouping → sort by
 * Profit → drill a row into the account ledger. Runs against the production build with the
 * in-process mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("profitability — load, switch grouping, sort, drill", async ({ page }) => {
  await login(page);
  await page.goto("/cost-control/profitability");
  await expect(page.getByTestId("profit-title")).toHaveText("Cost-centre profitability");

  // Loads at the default grouping (no context gate).
  await expect(page.getByTestId("profit-table")).toBeVisible();
  await expect(page.getByTestId("profit-row-loss").first()).toBeVisible();

  // Switch grouping to By project → re-query.
  await page.getByTestId("profit-mode-project").click();
  await expect(page.getByTestId("profit-table")).toBeVisible();

  // Sort by Profit (worst first).
  await page.getByTestId("profit-sort").click();
  await expect(page.getByTestId("profit-table")).toBeVisible();

  // Drill a row into the account ledger.
  await page.getByTestId("profit-drill").first().click();
  await page.waitForURL("**/ledger/account-ledger**");
});
