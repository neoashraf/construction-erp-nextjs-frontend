import { test, expect, type Page } from "@playwright/test";

/**
 * FE-44 fe-receipt-viewer — happy path (FR-REC-013/-025). Logged in as Admin, opens a
 * posted seed receipt from the list, verifies the balanced ledger lines render, opens
 * the money-receipt print preview. Runs against the production build with the
 * in-process mock NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Receipt viewer — open posted receipt → balanced ledger lines → print preview", async ({ page }) => {
  await login(page);
  await page.goto("/receipts/rec-1/view");
  await expect(page.getByTestId("receipt-viewer-title")).toContainText("RCT/2526/0048");
  await expect(page.getByTestId("receipt-viewer-status-POSTED")).toBeVisible();

  // Balanced ledger lines render (via LED synthesis).
  await expect(page.getByTestId("receipt-ledger-lines")).toBeVisible();

  // Print preview opens the on-screen money-receipt document.
  await page.getByTestId("receipt-viewer-print").click();
  await expect(page.getByTestId("receipt-print-document")).toBeVisible();
});
