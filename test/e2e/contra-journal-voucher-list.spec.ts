import { test, expect, type Page } from "@playwright/test";

/**
 * FE-48 fe-voucher-list — happy path (FR-GEN-020). Logged in as Admin, loads the
 * unified voucher list, filters to Journal + Posted, opens a posted journal row (routes
 * to its read-only view route). Runs against the production build with the in-process
 * mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Voucher list — load → filter Journal + Posted → open posted row", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/vouchers");
  await expect(page.getByTestId("voucher-list-title")).toContainText("Contra & journal vouchers");
  await page.getByTestId("voucher-list").waitFor();

  await page.getByTestId("voucher-filter-type-JOURNAL").click();
  await page.getByTestId("voucher-filter-status").selectOption("POSTED");
  await page.getByTestId("voucher-filter-apply").click();

  // Wait for the filtered re-fetch to actually land — a contra row must no longer
  // be present — before reading the first row's link (the container itself stays
  // mounted/visible across the refetch, so asserting on it alone would race the
  // network call and could still catch the pre-filter row).
  await expect(page.getByTestId(/^voucher-type-CONTRA$/)).toHaveCount(0);

  const firstLink = page.getByTestId(/^voucher-row-link-/).first();
  await expect(firstLink).toBeVisible();
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/\/contra-journal\/vouchers\/.+\?type=journal$/);
});
