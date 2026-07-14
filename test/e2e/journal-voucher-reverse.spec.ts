import { test, expect, type Page } from "@playwright/test";

/**
 * FE-50 fe-journal-voucher — reverse happy path (FR-GEN-018). Opens the seed posted
 * journal (`jnl-1`), reverses with a mandatory reason, asserts the status flips to
 * CANCELLED.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Journal editor — posted → reverse with reason → CANCELLED", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/vouchers/jnl-1?type=journal");
  await expect(page.getByTestId("journal-editor-title")).toContainText("JNL/2526/0022");
  await page.getByTestId("journal-editor-reverse").click();
  await page.getByTestId("voucher-reverse-reason").fill("Booking error");
  await page.getByTestId("voucher-reverse-confirm").click();
  await expect(page.getByTestId("voucher-status-CANCELLED")).toBeVisible({ timeout: 10_000 });
});
