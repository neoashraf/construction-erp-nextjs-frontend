import { test, expect, type Page } from "@playwright/test";

/**
 * FE-37 Salary sheet — Generate → edit a line → Post happy path (FR-HR-013..-015).
 * Logged in as Admin (holds `hr:salary:post`). Opens the runs list, enters the seeded DRAFT,
 * ticks the balanced-preview checkbox, and Posts. Asserts the sheet flips POSTED with the
 * server-issued `entryNo` link + "View payslips" CTA visible.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Salary sheet: enter DRAFT → edit line → Post → posted + View payslips", async ({ page }) => {
  await login(page);
  await page.goto("/hr/salary-sheets");
  await expect(page.getByTestId("salary-runs-title")).toHaveText("Salary sheet");

  // The mock BFF seeds one DRAFT sheet (`sal-draft-1`, periodLabel "2026-07").
  await page.getByTestId("salary-run-row-DRAFT").first().click();
  await expect(page.getByTestId("salary-editor")).toBeVisible();
  await expect(page.getByTestId("salary-inactive-note")).toBeVisible();

  // Edit a line's allowances (blur commits).
  const allowanceInput = page.getByTestId(/^line-allow-/).first();
  await allowanceInput.click();
  await allowanceInput.fill("1500");
  await allowanceInput.blur();
  // Totals footer stays live-updated.
  await expect(page.getByTestId("salary-totals")).toBeVisible();

  // Balanced-preview gate: check "Preview confirmed" before Post is enabled.
  await page.getByTestId("preview-confirmed").check();
  await page.getByTestId("post-open").click();
  const dialog = page.getByTestId("post-confirm-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("post-confirm").click();

  // Server-confirmed — the sheet flips to POSTED IN PLACE (no navigation).
  await expect(page.getByTestId("salary-status-POSTED")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("salary-entry-link")).toBeVisible();
  await expect(page.getByTestId("view-payslips")).toBeVisible();
});
