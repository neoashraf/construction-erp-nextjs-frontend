import { test, expect, type Page } from "@playwright/test";

/**
 * FE-31 Requisition issue happy path (FR-REQ-012…-019): open the issues worklist → open an
 * APPROVED/PARTIALLY_ISSUED requisition → enter a partial issue quantity → Issue → see the
 * result summary (entry no + value) and the refreshed balance. Runs against the production
 * build with the in-process mock NestJS (logged in as Admin — full REQ access).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("requisition issue — worklist → open → partial issue → result summary", async ({ page }) => {
  await login(page);

  await page.goto("/requisitions/issues");
  await expect(page.getByTestId("req-issues-title")).toHaveText("Issues");
  await expect(page.getByTestId("req-list")).toBeVisible();

  await page.getByTestId("req-open").first().click();
  await page.waitForURL(/\/requisitions\/issues\/req-/);
  await expect(page.getByTestId("req-issue-title")).toContainText("Issue requisition");
  await expect(page.getByTestId("req-issue-form")).toBeVisible();

  // Enter a small partial quantity on the first line and issue.
  await page.getByTestId("req-line-qty").first().fill("10.0000");
  await page.getByTestId("req-issue").click();

  // Server-confirmed: the result summary appears with the gapless entry number.
  await expect(page.getByTestId("req-issue-result")).toBeVisible();
  await expect(page.getByTestId("req-issue-result")).toContainText("SJ/2526/");
});
