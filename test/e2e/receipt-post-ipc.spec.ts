import { test, expect, type Page } from "@playwright/test";

/**
 * FE-43 fe-receipt-editor — IPC-linked happy path (FR-REC-001/002/009/013/024). Logged
 * in as Admin, drives the mode picker → IPC-linked → picks a posted IPC → saves as
 * DRAFT → posts → lands on the read-only viewer route (owned by FE-44 — this editor
 * only routes there). Runs against the production build with the in-process mock
 * NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Receipt editor — new IPC-linked draft → save → post → viewer", async ({ page }) => {
  await login(page);
  await page.goto("/receipts/new");
  await expect(page.getByTestId("receipt-editor-title")).toHaveText("New receipt");

  // Pick IPC-linked mode; the mode picker card is a role="radio".
  await page.getByTestId("receipt-mode-ipc").click();
  await expect(page.getByTestId("receipt-ipc-card")).toBeVisible();

  // Fill shared header. The mock exposes at least one active deposit account.
  await page.getByLabel(/^Receipt date/, { exact: true }).fill("12/07/2026");
  await page.getByTestId("receipt-mode-BANK_TRANSFER").click();
  await page.getByLabel(/^Deposit account/).selectOption({ index: 1 });
  await page.getByTestId("receipt-cheque-ref").fill("TXN-2026-777");

  // Pick a customer that has posted IPCs (mocked customer pa-8 with IPCs).
  await page.getByTestId("receipt-customer").selectOption("pa-8");
  // Pick the first available posted IPC.
  await page.getByTestId("receipt-ipc").selectOption({ index: 1 });
  await expect(page.getByTestId("receipt-ipc-inherited")).toBeVisible();

  // Amount + tax — the derived cash-received panel updates live.
  await page.getByTestId("receipt-amount-settled").fill("100000");
  await page.getByTestId("receipt-tds").fill("5000");
  await expect(page.getByTestId("receipt-cash-received")).toContainText("95,000");

  // Save the draft; the URL replaces to /receipts/{id}.
  await page.getByTestId("receipt-save").click();
  await page.waitForURL(/\/receipts\/rec-new-\d+$/);

  // Post → confirm dialog → post → viewer route.
  await page.getByTestId("receipt-post").click();
  await expect(page.getByTestId("receipt-post-dialog")).toBeVisible();
  await page.getByTestId("receipt-post-confirm").click();
  await page.waitForURL(/\/receipts\/rec-new-\d+\/view$/, { timeout: 15_000 });
});
