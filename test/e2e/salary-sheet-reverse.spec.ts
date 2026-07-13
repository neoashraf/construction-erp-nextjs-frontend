import { test, expect, type Page } from "@playwright/test";

/**
 * FE-37 Salary sheet — Reverse a POSTED run (FR-HR-018). Logged in as Admin. Opens the
 * seeded POSTED sheet, opens the Reverse dialog, types a reason, submits, and asserts
 * the sheet flips to REVERSED with the linked reversal `entryNo` link visible next to
 * the original entry link (append-only ledger — the original is untouched).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Salary sheet: Reverse a POSTED run → REVERSED badge + reversal link", async ({ page }) => {
  await login(page);
  await page.goto("/hr/salary-sheets");
  await expect(page.getByTestId("salary-runs-title")).toHaveText("Salary sheet");

  // The mock seeds a POSTED sheet at `/hr/salary-sheets/sal-posted-1`.
  await page.goto("/hr/salary-sheets/sal-posted-1");
  await expect(page.getByTestId("salary-editor")).toBeVisible();
  await expect(page.getByTestId("salary-status-POSTED")).toBeVisible();

  await page.getByTestId("reverse-open").click();
  const dialog = page.getByTestId("reverse-salary-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("rev-reason").fill("TDS applied to the wrong staff group.");
  await dialog.getByTestId("rev-confirm").click();

  await expect(page.getByTestId("salary-status-REVERSED")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("salary-reversal-link")).toBeVisible();
});
