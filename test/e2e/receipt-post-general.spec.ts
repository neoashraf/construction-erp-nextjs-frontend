import { test, expect, type Page } from "@playwright/test";

/**
 * FE-43 fe-receipt-editor — General happy path (FR-REC-001/003/007/009/011/013). Logged
 * in as Admin, drives the mode picker → General → picks a party + income/advance target
 * + cost centre → posts → lands on the viewer route. Runs against the production build
 * with the in-process mock NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Receipt editor — new general draft → post → viewer", async ({ page }) => {
  await login(page);
  await page.goto("/receipts/new");
  await expect(page.getByTestId("receipt-editor-title")).toHaveText("New receipt");

  // Pick General mode; the mode picker card is a role="radio".
  await page.getByTestId("receipt-mode-general").click();
  await expect(page.getByTestId("receipt-general-card")).toBeVisible();

  // Fill shared header — CASH mode hides the reference field entirely (FR-REC-004).
  await page.getByLabel(/^Receipt date/, { exact: true }).fill("12/07/2026");
  await page.getByTestId("receipt-mode-CASH").click();
  await expect(page.getByTestId("receipt-cheque-ref")).toHaveCount(0);
  await page.getByLabel(/^Deposit account/).selectOption({ index: 1 });

  // Allocation: party + general target + cost centre; project intentionally left blank.
  await page.getByTestId("receipt-party").selectOption({ index: 1 });
  await page.getByTestId("receipt-target").selectOption({ index: 1 });
  await page.getByTestId("receipt-cost-centre").selectOption({ index: 1 });
  // The "General (no project)" tag surfaces when project is blank (FR-REC-003, FR-REC-007).
  await expect(page.getByTestId("receipt-general-note")).toBeVisible();

  // Money — no tax field on a general receipt (spec §5B).
  await page.getByTestId("receipt-amount-settled").fill("30000");
  await expect(page.getByTestId("receipt-tds")).toHaveCount(0);

  // Post — no Save needed; the editor persists then posts inside the confirm dialog.
  await page.getByTestId("receipt-post").click();
  await expect(page.getByTestId("receipt-post-dialog")).toBeVisible();
  await page.getByTestId("receipt-post-confirm").click();
  await page.waitForURL(/\/receipts\/rec-new-\d+\/view$/, { timeout: 15_000 });
});
