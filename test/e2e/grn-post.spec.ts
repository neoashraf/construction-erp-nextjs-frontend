import { test, expect, type Page } from "@playwright/test";

/**
 * FE-41 GRN & matching — post happy path (FR-PUR-015/-016/-017/-018). Logged in
 * as Admin (has purchase.grn writes via the ADMIN wildcard), creates a DRAFT GRN
 * against an approved PO end-to-end: pick a PO → line prefills with the open
 * quantity → Save draft → Post behind the confirm dialog → routed to the read-only
 * posted view with the "GRN posted — inventory updated." banner. Runs against
 * the production build with the in-process mock NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("GRN entry — pick PO → save draft → post → inventory updated banner", async ({ page }) => {
  await login(page);
  await page.goto("/purchase/grn/new");
  await expect(page.getByTestId("grn-form-title")).toHaveText("New goods receipt");

  // Pick the seeded APPROVED PO — its open line prefills the received qty.
  await page.getByTestId("po-picker").selectOption("po-101");
  await expect(page.getByTestId("grn-line-received-0")).not.toHaveValue("");

  // Save draft — persists and redirects to the persisted detail route.
  await page.getByTestId("grn-save").click();
  await page.waitForURL(/\/purchase\/grn\/grn-\d+$/);

  // Post behind the confirm dialog (INV `receiveIn` per line; no ledger write).
  await page.getByTestId("grn-post").click();
  await expect(page.getByTestId("grn-post-dialog")).toBeVisible();
  await page.getByTestId("grn-post-confirm").click();

  // The GRN lands as read-only with the success banner and posted meta.
  await expect(page.getByTestId("grn-posted-banner")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("grn-status-POSTED").first()).toBeVisible();
  await expect(page.getByTestId("grn-posted-meta")).toBeVisible();
  // No cancel/repost affordance on a posted GRN (correction is via the parent bill).
  await expect(page.getByTestId("grn-cancel")).toHaveCount(0);
  await expect(page.getByTestId("grn-repost")).toHaveCount(0);
});
