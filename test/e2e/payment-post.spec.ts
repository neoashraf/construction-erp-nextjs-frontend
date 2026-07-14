import { test, expect, type Page } from "@playwright/test";

/**
 * FE-46 fe-payment-editor — post happy path (FR-PAY-001/-005/-009/-013). Logged in as
 * Admin, opens a fresh draft, picks a payee, adds a payable at full outstanding, hits
 * Post — lands on the viewer route with the allocated entryNo in the URL.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Payment editor — new draft → allocate → post → viewer", async ({ page }) => {
  await login(page);
  await page.goto("/payments/new");
  await expect(page.getByTestId("payment-editor-title")).toHaveText("New payment");

  await page.getByTestId("payment-editor-party").selectOption("pa-1");
  await page.getByLabel(/^Payment date/, { exact: true }).fill("12/07/2026");
  await page.getByTestId("payment-editor-mode-CASH").click();
  await page.getByLabel(/^Paying account/).selectOption({ index: 1 });
  // Pick a payable, then align paymentAmount to its remainingOutstanding.
  await page.getByTestId("payment-allocation-add").click();
  const firstPick = page.getByTestId(/^open-payables-pick-/).first();
  await firstPick.click();
  const amount = page.getByTestId(/^payment-allocation-amount-/).first();
  const remaining = await amount.inputValue();
  await page.getByTestId("payment-editor-amount").fill(remaining);
  await expect(page.getByTestId("payment-editor-post")).toBeEnabled();
  await page.getByTestId("payment-editor-post").click();
  await page.getByTestId("payment-post-confirm").click();
  await page.waitForURL(/\/payments\/pay-new-\d+\/view$/, { timeout: 15_000 });
});
