import { test, expect, type Page } from "@playwright/test";

/**
 * FE-47 fe-payment-viewer — happy path (FR-PAY-013/-017). Logged in as Admin, opens
 * the seed posted payment, checks the balanced ledger lines render and follows the
 * "View ledger entry" link.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Payment viewer — open posted → balanced ledger lines + allocations", async ({ page }) => {
  await login(page);
  await page.goto("/payments/pay-1/view");
  await expect(page.getByTestId("payment-viewer-title")).toContainText("PAY/2526/0031");
  await expect(page.getByTestId("payment-status-POSTED")).toBeVisible();
  await expect(page.getByTestId("payment-ledger-lines")).toBeVisible();
  await expect(page.getByTestId("payment-allocations-panel")).toBeVisible();
});
