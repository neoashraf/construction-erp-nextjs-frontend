import { test, expect, type Page } from "@playwright/test";

/**
 * FE-30 Requisition approval happy path (FR-REQ-008…-011): open the approvals worklist → open a
 * SUBMITTED PM-tier requisition → Approve → land back on the worklist with the row gone from
 * the queue. Runs against the production build with the in-process mock NestJS (logged in as
 * Admin — full REQ decision authority).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("requisition approval — worklist → open → approve → back to worklist", async ({ page }) => {
  await login(page);

  await page.goto("/requisitions/approvals");
  await expect(page.getByTestId("req-approvals-title")).toHaveText("Approvals");
  await expect(page.getByTestId("req-list")).toBeVisible();

  // Open a SUBMITTED requisition's review detail (rows route to /requisitions/approvals/[id]).
  await page.getByTestId("req-open").first().click();
  await page.waitForURL(/\/requisitions\/approvals\/req-/);
  await expect(page.getByTestId("req-approval-title")).toContainText("Review requisition");
  await expect(page.getByTestId("req-tier-banner-in-tier")).toBeVisible();

  // Approve → server-confirmed → redirect to the worklist.
  await page.getByTestId("req-approve").first().click();
  await page.waitForURL(/\/requisitions\/approvals$/);
  await expect(page.getByTestId("req-approvals-title")).toBeVisible();
});
