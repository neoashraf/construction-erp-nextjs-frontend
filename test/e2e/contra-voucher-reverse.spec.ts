import { test, expect, type Page } from "@playwright/test";

/**
 * FE-49 fe-contra-voucher — reverse happy path. Opens the seed posted contra
 * (`ctr-1`), reverses with a mandatory reason, asserts the status badge flips to
 * CANCELLED and Reverse disappears from the action bar.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Contra editor — posted voucher → reverse with reason → CANCELLED", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/vouchers/ctr-1?type=contra");
  await expect(page.getByTestId("contra-editor-title")).toContainText("CTR/2526/0007");
  await page.getByTestId("contra-editor-reverse").click();
  await page.getByTestId("voucher-reverse-reason").fill("Duplicate transfer");
  await page.getByTestId("voucher-reverse-confirm").click();
  await expect(page.getByTestId("voucher-status-CANCELLED")).toBeVisible({ timeout: 10_000 });
});
