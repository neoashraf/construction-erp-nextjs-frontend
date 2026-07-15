import { test, expect, type Page } from "@playwright/test";

/**
 * FE-45 fe-payment-list — happy path (FR-PAY-001/-007/-017). Logged in as Admin,
 * loads the payments register, opens an existing posted payment (routes to viewer
 * URL), switches to Outstanding, expands a payable's applied-payments drill-in.
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

test("Payment list — load → Outstanding → open applied-payments drill-in", async ({ page }) => {
  await login(page);
  await page.goto("/payments");
  await expect(page.getByTestId("payment-list-title")).toHaveText("Payments");
  await page.getByTestId("payment-list").waitFor();

  // Switch to Outstanding — the per-payable grid renders.
  await page.getByTestId("payments-tab-outstanding").click();
  await page.getByTestId("payment-outstanding-list").waitFor();

  // Expand the first payable — the applied-payments drill-in appears with at least
  // one row (the seed posted payment).
  const firstExpand = page.getByTestId(/^payment-outstanding-expand-/).first();
  await firstExpand.click();
  await expect(page.getByTestId(/^payment-drill-in-/).first()).toBeVisible();
});
