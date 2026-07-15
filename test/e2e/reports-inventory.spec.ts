import { test, expect, type Page } from "@playwright/test";

/**
 * FE-58 fe-inventory-reports — happy path (FR-RPT-021/023/029). Open the
 * viewer → run Stock valuation as-of a date → see the reconciling totals
 * footer → switch to Stock transfer summary → run over a date range → see
 * the transfer rows + Total value moved → Export to Excel triggers a
 * download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Inventory reports — valuation as-of → totals → transfer summary → export Excel", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/reports/inventory");
  await expect(page.getByTestId("iv-title")).toContainText("Inventory reports");
  await expect(page.getByTestId("iv-readonly-pill")).toContainText("Read-only");

  // Stock valuation as-of. The Fill must land before Run — react panel's
  // controlled-input needs the state update to propagate.
  const asOf = page.getByTestId("param-as-of");
  await asOf.scrollIntoViewIfNeeded();
  await asOf.focus();
  await asOf.fill("2026-06-30");
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="param-as-of"]') as HTMLInputElement)?.value === "2026-06-30",
    undefined,
    { timeout: 5000 },
  );
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("iv-sv-table")).toBeVisible();
  await expect(page.getByTestId("iv-sv-totals-footer")).toContainText(/reconciles to Inventory control/);

  // Excel export triggers a download.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export-excel").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // Transfer summary.
  await page.getByTestId("iv-tab-TRANSFER_SUMMARY").click();
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("iv-ts-table")).toBeVisible();
  await expect(page.getByTestId("iv-ts-totals-footer")).toContainText(/Total value moved/);
});
