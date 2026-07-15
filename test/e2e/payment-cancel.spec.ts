import { test, expect, type Page } from "@playwright/test";

/**
 * FE-46 fe-payment-editor — cancel happy path (FR-PAY-018/-019). Opens a seed posted
 * payment (`pay-1`), hits Cancel, submits a reason, and asserts the CANCELLED status
 * badge appears on the same page.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Payment editor — posted payment → cancel with reason → CANCELLED", async ({ page }) => {
  await login(page);
  await page.goto("/payments/pay-1");
  await expect(page.getByTestId("payment-editor-title")).toContainText("PAY/2526/0031");
  await page.getByTestId("payment-editor-cancel-btn").click();
  await page.getByTestId("payment-cancel-reason").fill("Wrong supplier");
  await page.getByTestId("payment-cancel-confirm").click();
  // The React Query invalidation triggers a re-fetch, and the badge flips.
  await expect(page.getByTestId("payment-status-CANCELLED")).toBeVisible({ timeout: 10_000 });
});
