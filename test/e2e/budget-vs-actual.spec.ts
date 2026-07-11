import { test, expect, type Page } from "@playwright/test";

/**
 * FE-24 budget-vs-actual happy path (FR-CC-008): load → pick a project → Apply →
 * rows render → switch to By cost centre → drill a row into the account ledger.
 * Runs against the production build with the in-process mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("budget vs actual — load, switch mode, drill", async ({ page }) => {
  await login(page);
  await page.goto("/cost-control/budget-vs-actual");
  await expect(page.getByTestId("bva-title")).toHaveText("Budget vs Actual");

  // Context gate: prompt before a project is chosen.
  await expect(page.getByTestId("bva-pick-context")).toBeVisible();

  // Pick a project + Apply → rows render.
  await page.getByTestId("bva-project").selectOption("proj-a");
  await page.getByTestId("bva-apply").click();
  await expect(page.getByTestId("bva-table")).toBeVisible();
  await expect(page.getByText("Materials — Cement & Steel").first()).toBeVisible();
  await expect(page.getByTestId("cc-status-OVER").first()).toBeVisible();

  // Switch to By cost centre → the fixed selector swaps.
  await page.getByTestId("bva-mode-cost_centre").click();
  await expect(page.getByTestId("bva-cost-centre")).toBeVisible();
  await page.getByTestId("bva-cost-centre").selectOption("cc-mat");
  await page.getByTestId("bva-apply").click();
  await expect(page.getByTestId("bva-table")).toBeVisible();

  // Drill a row into the account ledger.
  await page.getByTestId("bva-drill").first().click();
  await page.waitForURL("**/ledger/account-ledger**");
});
