import { test, expect, type Page } from "@playwright/test";

/**
 * FE-42 fe-receipt-list — happy path (FR-REC-016/-018/-025). Logged in as Admin,
 * loads the receipts register, narrows to Posted via the status chip, opens a posted
 * row, and lands on the read-only viewer route (owned by FE-44 — this list only
 * routes there). Runs against the production build with the in-process mock NestJS
 * (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Receipt list — load → filter to Posted → open a posted row → viewer route", async ({
  page,
}) => {
  await login(page);
  await page.goto("/receipts");
  await expect(page.getByTestId("receipt-list-title")).toHaveText("Receipts");
  await page.getByTestId("receipt-list").waitFor();

  // Narrow to Posted only, then Apply.
  await page.getByTestId("receipt-filter-status-POSTED").click();
  await page.getByTestId("receipt-filter-apply").click();
  await expect(page.getByTestId("receipt-list")).toBeVisible();
  await expect(page.getByTestId("receipt-row-DRAFT")).toHaveCount(0);
  await expect(page.getByTestId("receipt-row-CANCELLED")).toHaveCount(0);

  // Open the first posted row — routes to the read-only viewer, not the editor.
  const firstView = page.getByTestId("receipt-view").first();
  const href = await firstView.getAttribute("href");
  await firstView.click();
  await page.waitForURL(/\/receipts\/.+\/view$/);
  expect(page.url()).toContain(href);
});
