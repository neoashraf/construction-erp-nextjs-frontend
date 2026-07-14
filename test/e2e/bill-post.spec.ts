import { test, expect, type Page } from "@playwright/test";

/**
 * FE-40 Purchase Bills post happy path (FR-PUR-004…-013). Logged in as Admin, creates a
 * DRAFT bill end-to-end: supplier + project + bill/due dates + one stock line with the
 * four dimensions, Save draft → Post behind the confirm dialog → routed to the viewer
 * with the allocated entryNo, balanced ledger-lines table, and inventory panel. Runs
 * against the production build with the in-process mock NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Bill editor — create draft → save → post behind the confirm dialog", async ({ page }) => {
  await login(page);
  await page.goto("/purchase/bills/new");
  await expect(page.getByTestId("bill-form-title")).toHaveText("New purchase bill");

  // Header.
  await page.getByTestId("bill-supplier").selectOption("pa-1");
  await page.getByTestId("bill-project").selectOption("proj-a");
  await page.getByLabel(/^Bill date/, { exact: true }).fill("13/07/2026");
  await page.getByLabel(/^Due date/, { exact: true }).fill("13/08/2026");

  // First line (stock — item + four dimensions + qty + rate).
  await page.getByTestId("bill-line-item").first().selectOption("it-cement");
  await page.getByTestId("bill-line-qty").first().fill("120");
  await page.getByTestId("bill-line-rate").first().fill("520");
  await page.getByTestId("bill-line-godown").first().selectOption("gd-a");
  await page.getByTestId("bill-line-cc").first().selectOption("cc-mat");
  await page.getByTestId("bill-line-purpose").first().selectOption("pp-1");

  // Live totals reflect 120 × 520 = 62,400 (with zero taxes → net payable = gross).
  await expect(page.getByTestId("bill-net-payable")).toContainText("62,400");

  // Save draft — redirects to the persisted detail route.
  await page.getByTestId("bill-save").click();
  await page.waitForURL(/\/purchase\/bills\/bill-\d+$/);

  // Post behind the confirm dialog (atomic — LED + INV + NUM, no optimistic flip).
  await page.getByTestId("bill-post").click();
  await expect(page.getByTestId("bill-post-dialog")).toBeVisible();
  await page.getByTestId("bill-post-confirm").click();

  // The bill lands on the viewer with the allocated entryNo + inventory panel.
  // (The balanced-ledger-lines table is unit-tested via bill-viewer.test.tsx — the
  // LED entry fetch is a follow-up XHR beyond the post response's happy path here.)
  await expect(page.getByTestId("bill-viewer")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("bill-status-POSTED").first()).toBeVisible();
  await expect(page.getByTestId("bill-viewer-title")).toContainText("PUR/");
  await expect(page.getByTestId("bill-inventory-panel")).toBeVisible();
});
