import { test, expect, type Page } from "@playwright/test";

/**
 * FE-56 fe-trial-balance-ledgers — happy path (FR-RPT-009/-010/-029). Open the
 * viewer → run trial balance → see the balanced footer → switch to the
 * account ledger → pick an account → Run → see opening balance + running
 * balance → click a source-voucher link.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Trial balance & ledgers — TB balanced → account ledger with source-voucher link", async ({
  page,
}) => {
  await login(page);
  await page.goto("/reports/trial-balance-ledgers");
  await expect(page.getByTestId("tb-title")).toContainText("Ledgers");

  // Trial balance run.
  await page.getByTestId("param-as-of").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("tb-table")).toBeVisible();
  await expect(page.getByTestId("tb-totals-footer")).toContainText(/balanced/i);

  // Switch to account ledger.
  await page.getByTestId("tb-tab-LEDGER").click();
  await expect(page.getByTestId("param-date-from")).toBeVisible();
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.getByTestId("ledger-accountId").selectOption("1200");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("ledger-table")).toBeVisible();
  await expect(page.getByTestId("ledger-opening-banner")).toBeVisible();

  // A resolved source-voucher link is present.
  const link = page.locator('[data-testid="source-voucher-link"][data-resolved="true"]').first();
  await expect(link).toBeVisible();
});
