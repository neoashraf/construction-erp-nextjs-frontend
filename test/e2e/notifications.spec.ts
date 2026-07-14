import { test, expect, type Page } from "@playwright/test";

/**
 * FE-53 fe-notifications — happy path (FR-NTF-005/-013/-015). Login → the topbar
 * bell shows a live badge from GET /api/notifications/unread-count → open the
 * drawer → open /notifications and filter to Unread → the filtered feed renders.
 * The mock backend seeds a handful of notifications for admin@ze.test (including
 * a HIGH BUDGET_BREACH row) — see `mock-nestjs.ts` `getMockNotifStore`.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Notifications — bell badge → open drawer → visit /notifications", async ({ page }) => {
  await login(page);

  // Badge visible after the unread-count fetch resolves.
  await expect(page.getByTestId("notifications-bell")).toBeVisible();
  await expect(page.getByTestId("notifications-badge")).toBeVisible();

  // Open the drawer, see the seeded rows.
  await page.getByTestId("notifications-bell").click();
  await expect(page.getByTestId("notifications-drawer")).toBeVisible();
  await expect(page.getByTestId("notifications-list")).toBeVisible();
  await expect(page.getByText(/Budget breach/i).first()).toBeVisible();

  // See-all navigates to the notifications page.
  await page.getByTestId("drawer-see-all").click();
  await page.waitForURL("**/notifications");
  await expect(page.getByTestId("notifications-page")).toBeVisible();

  // Filter to Unread + Apply.
  await page.getByTestId("filter-read-unread").click();
  await page.getByTestId("filter-apply").click();
  await expect(page.getByTestId("notifications-list")).toBeVisible();
});
