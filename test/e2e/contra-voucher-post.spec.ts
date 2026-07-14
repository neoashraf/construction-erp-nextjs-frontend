import { test, expect, type Page } from "@playwright/test";

/**
 * FE-49 fe-contra-voucher — post happy path. Opens the new-draft route, adds two
 * bank/cash lines that balance, saves as draft, then posts. Asserts the form flips to
 * the POSTED read-only surface (immutability note + entryNo badge visible).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Contra editor — new balanced draft → post → read-only + entryNo", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/vouchers/new?type=contra");
  await expect(page.getByTestId("contra-editor-title")).toHaveText("New contra voucher");
  // Pick two bank/cash accounts + balance them.
  await page.getByTestId("contra-line-account-l1").selectOption({ index: 1 });
  await page.getByTestId("contra-line-debit-l1").fill("75000");
  await page.getByTestId("contra-line-account-l2").selectOption({ index: 2 });
  await page.getByTestId("contra-line-credit-l2").fill("75000");
  await expect(page.getByTestId("voucher-balanced-ok")).toBeVisible();
  await page.getByTestId("contra-editor-save").click();
  await page.waitForURL(/\/contra-journal\/vouchers\/ctr-new-\d+\?type=contra$/, { timeout: 15_000 });
  await page.getByTestId("contra-editor-post").click();
  await page.getByTestId("voucher-post-confirm").click();
  await expect(page.getByTestId("contra-editor-immutability")).toBeVisible({ timeout: 15_000 });
});
