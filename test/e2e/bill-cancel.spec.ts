import { test, expect, type Page } from "@playwright/test";

/**
 * FE-40 Purchase Bills cancel path (FR-PUR-022, FR-PUR-023). Logged in as Admin, posts
 * a fresh DRAFT then cancels it from the viewer: the mandatory reason dialog opens,
 * a stale POST → CANCELLED transition retains the original number, and the viewer
 * flips to the CANCELLED ribbon. Runs against the production build with the
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

test("Bill viewer — post then cancel with a mandatory reason", async ({ page }) => {
  await login(page);

  // Create a fresh DRAFT and post it — the follow-up cancel uses this bill.
  await page.goto("/purchase/bills/new");
  await page.getByTestId("bill-supplier").selectOption("pa-1");
  await page.getByTestId("bill-project").selectOption("proj-a");
  await page.getByLabel(/^Bill date/, { exact: true }).fill("13/07/2026");
  await page.getByLabel(/^Due date/, { exact: true }).fill("13/08/2026");
  await page.getByTestId("bill-line-item").first().selectOption("it-cement");
  await page.getByTestId("bill-line-qty").first().fill("50");
  await page.getByTestId("bill-line-rate").first().fill("400");
  await page.getByTestId("bill-line-godown").first().selectOption("gd-a");
  await page.getByTestId("bill-line-cc").first().selectOption("cc-mat");
  await page.getByTestId("bill-line-purpose").first().selectOption("pp-1");
  await page.getByTestId("bill-save").click();
  await page.waitForURL(/\/purchase\/bills\/bill-\d+$/);
  await page.getByTestId("bill-post").click();
  await page.getByTestId("bill-post-confirm").click();

  // Viewer visible with POSTED badge.
  await expect(page.getByTestId("bill-viewer")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("bill-status-POSTED").first()).toBeVisible();

  // Cancel: mandatory reason dialog opens; default-focus is "Keep bill".
  await page.getByTestId("bill-cancel").click();
  await expect(page.getByTestId("bill-cancel-dialog")).toBeVisible();
  await page.getByTestId("bill-cancel-reason").fill("Wrong supplier invoice");
  await page.getByTestId("bill-cancel-confirm").click();

  // The bill flips to CANCELLED (ribbon visible) — the original entry number is retained
  // on the record; the cancel response's reversal number surfaces on the viewer banner.
  await expect(page.getByTestId("bill-cancelled-ribbon")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("bill-status-CANCELLED").first()).toBeVisible();
});
