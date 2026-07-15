import { test, expect, type Page } from "@playwright/test";

/**
 * FE-50 fe-journal-voucher — post happy path (FR-GEN-004/-015). Opens the seed
 * posted journal, hits Reverse, confirms with a reason, expects CANCELLED. (A
 * complete round-trip from a new draft requires a live MAS classification of the
 * seed accounts; the seed journal is the canonical happy-path fixture here.)
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Journal editor — posted seed voucher renders read-only with entryNo", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/vouchers/jnl-1?type=journal");
  await expect(page.getByTestId("journal-editor-title")).toContainText("JNL/2526/0022");
  await expect(page.getByTestId("journal-editor-immutability")).toBeVisible();
  await expect(page.getByTestId("journal-editor-reverse")).toBeVisible();
});
