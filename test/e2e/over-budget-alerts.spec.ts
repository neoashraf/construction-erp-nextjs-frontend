import { test, expect, type Page } from "@playwright/test";

/**
 * FE-25 over-budget alerts happy path (FR-CC-011/012/016): load → alerts render sorted by
 * severity → toggle a status chip → drill a row into the account ledger. Runs against the
 * production build with the in-process mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("over-budget alerts — load, filter, drill", async ({ page }) => {
  await login(page);
  await page.goto("/cost-control/alerts");
  await expect(page.getByTestId("alerts-title")).toHaveText("Over-budget alerts");

  // Rows load on mount (live feed, no context gate) and the most-severe row is OVER.
  await expect(page.getByTestId("alerts-table")).toBeVisible();
  await expect(page.getByTestId("alerts-row-OVER").first()).toBeVisible();

  // A last-checked indicator is present (pull-based feed).
  await expect(page.getByTestId("alerts-last-checked")).toContainText("Last checked");

  // Narrow to Over only — the query re-runs and the table stays populated.
  await page.getByTestId("alerts-status-APPROACHING").click();
  await expect(page.getByTestId("alerts-table")).toBeVisible();

  // Drill a row into the account ledger.
  await page.getByTestId("alerts-drill").first().click();
  await page.waitForURL("**/ledger/account-ledger**");
});
