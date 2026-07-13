import { test, expect, type Page } from "@playwright/test";

/**
 * FE-31 negative-stock authorised override (FR-REQ-016): on an APPROVED requisition whose line
 * balance exceeds the source godown's on-hand, an authorised actor gets the "Issue anyway
 * (authorised)" toggle + a mandatory reason and can still issue. req-7 (rebar balance 20 vs
 * gd-a on-hand 18) is the seeded scenario. Runs against the production build + mock NestJS.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("requisition issue — negative-stock authorised override path", async ({ page }) => {
  await login(page);

  await page.goto("/requisitions/issues/req-7");
  await expect(page.getByTestId("req-issue-form")).toBeVisible();

  // "Issue all" fills the balance (20), which exceeds the 18 on hand → the override appears.
  await page.getByTestId("req-issue-all").first().click();
  await expect(page.getByTestId("req-negstock").first()).toContainText("below zero");

  await page.getByTestId("req-negstock-toggle").first().click();
  await page
    .getByTestId("req-negstock-reason")
    .first()
    .fill("GRN for the top-up is in transit — confirmed by phone.");

  await page.getByTestId("req-issue").click();
  await expect(page.getByTestId("req-issue-result")).toBeVisible();
});
