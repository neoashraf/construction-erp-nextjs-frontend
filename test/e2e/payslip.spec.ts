import { test, expect, type Page } from "@playwright/test";

/**
 * FE-38 Payslip — happy path (FR-HR-017). Logs in as Admin, opens the seeded POSTED run
 * (`sal-posted-1`, periodLabel "2026-06", entryNo "SAL/2526/0001"), navigates to its
 * payslip list, opens one employee's single payslip, and clicks Print. We assert
 * `window.print()` was invoked (stubbed to prevent the real dialog opening in CI).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Payslip: open posted run's payslips → open one employee → Print invoked", async ({ page }) => {
  await login(page);

  // Stub window.print BEFORE any user interaction so the real dialog never opens.
  await page.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
    };
  });

  // Enter the payslip list directly for the seeded POSTED run.
  await page.goto("/hr/salary-sheets/sal-posted-1/payslips");
  await expect(page.getByTestId("payslip-list")).toBeVisible();
  await expect(page.getByTestId("payslip-list-title")).toContainText("Payslips —");

  // FR-HR-013a: the seeded run's EMP-001 carries 7 lates → 2 penalty days — the list's
  // Late column predicts the question before the document answers it.
  await expect(page.getByTestId("payslip-late-emp-1")).toContainText("7 → 2d");

  // Open the penalised employee's single-document view.
  await page.getByTestId("payslip-view-emp-1").click();

  // Single-payslip document renders with the earnings + deductions blocks + net row.
  await expect(page.getByTestId("payslip-doc")).toBeVisible();
  await expect(page.getByTestId("payslip-earnings")).toBeVisible();
  await expect(page.getByTestId("payslip-deductions")).toBeVisible();
  await expect(page.getByTestId("payslip-net-row")).toBeVisible();

  // The late-penalty line sits inside Earnings, labelled with cause → rule → cost,
  // BEFORE Print is invoked (FR-HR-013a; the document must explain the docked pay).
  await expect(page.getByTestId("payslip-late-penalty")).toBeVisible();
  await expect(page.getByTestId("payslip-late-penalty")).toContainText("Late penalty (7 lates → 2 days)");

  // Invoke Print.
  await page.getByTestId("payslip-print").click();
  const calls = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
  expect(calls).toBeGreaterThanOrEqual(1);
});
