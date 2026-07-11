import { test, expect, type Page } from "@playwright/test";

/**
 * FE-27 Stock Journal negative-stock override (FR-INV-014/015): an ISSUE for more than the
 * on-hand balance raises the warning; an authorised (Admin) actor gets the "Allow negative
 * stock?" dialog requiring a reason, then posts. Runs against the production build.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("stock journal — negative-stock override path", async ({ page }) => {
  await login(page);
  await page.goto("/inventory/stock-journals/new");
  await page.getByTestId("sj-mode-ISSUE").click();
  await page.getByTestId("sj-item").selectOption("it-cement");
  // On hand at G-Site-A is 1240 bags — issue more to trigger the negative warning.
  await page.getByTestId("sj-qty").fill("2000");
  await page.getByTestId("sj-out-project").selectOption("proj-a");
  await page.getByTestId("sj-out-cost-centre").selectOption("cc-mat");
  await page.getByTestId("sj-out-godown").selectOption("gd-a");
  await page.getByTestId("sj-out-purpose").selectOption({ index: 1 });

  await expect(page.getByTestId("sj-negative-warning")).toBeVisible();

  await page.getByTestId("sj-save").click();
  await expect(page.getByTestId("sj-approve")).toBeVisible();
  await page.getByTestId("sj-approve").click();
  await page.getByTestId("sj-post").click();

  // Authorised actor → override dialog (not a hard stop).
  await expect(page.getByTestId("sj-negative-dialog")).toBeVisible();
  await page.getByTestId("sj-negative-authorise").check();
  await page.getByTestId("sj-negative-reason").fill("issued before the next delivery arrives");
  await page.getByTestId("sj-negative-confirm").click();

  await expect(page.getByTestId("sj-status-POSTED")).toBeVisible();
  await expect(page.getByTestId("sj-reverse")).toBeVisible();
});
