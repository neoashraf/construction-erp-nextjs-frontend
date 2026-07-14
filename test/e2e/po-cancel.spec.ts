import { test, expect, type Page } from "@playwright/test";

/**
 * FE-39 Purchase Orders cancel path (FR-PUR-002). Opens the seeded APPROVED PO
 * (`po-101`, PO-2026-0101) as Admin, cancels it behind the mandatory-reason dialog,
 * and asserts the status flips to CANCELLED. Runs against the in-process mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("PO — cancel an APPROVED PO with a mandatory reason → CANCELLED", async ({ page }) => {
  await login(page);
  await page.goto("/purchase/orders/po-101");
  await expect(page.getByTestId("po-form-title")).toHaveText("PO-2026-0101");
  await expect(page.getByTestId("po-status-APPROVED").first()).toBeVisible();

  await page.getByTestId("po-cancel").click();
  await expect(page.getByTestId("po-cancel-dialog")).toBeVisible();

  // Empty submission should surface the mandatory-reason error inline (not close the dialog).
  await page.getByTestId("po-cancel-confirm").click();
  await expect(page.getByText("Enter a reason for the cancellation.")).toBeVisible();

  // Then a valid reason confirms the cancellation.
  await page.getByTestId("po-cancel-reason").fill("Duplicate order raised in error");
  await page.getByTestId("po-cancel-confirm").click();

  // The PO flips CANCELLED.
  await expect(page.getByTestId("po-status-CANCELLED").first()).toBeVisible({ timeout: 10_000 });
});
