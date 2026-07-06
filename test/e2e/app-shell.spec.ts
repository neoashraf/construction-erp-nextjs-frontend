import { test, expect, type Page } from "@playwright/test";

/**
 * FE-SHELL app-shell happy path (screen spec §3/§4/§9): log in → land on the shell →
 * drill through the two-level nav to a built screen (≤ 2 clicks, no ModuleIndex card) →
 * collapse the sidebar to the 56px icon rail and confirm the choice persists across a
 * reload. The full role-filtering / accordion / switcher / Ctrl+K matrix is in the
 * component tests; this proves the assembled frame works end-to-end.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

/**
 * The mock backend only serves the auth routes; every data endpoint 404s. The shell
 * degrades gracefully on that (switcher → short IDs), but the trial-balance screen we
 * drill into expects its own data — stub the masters + trial-balance endpoints so the
 * drill lands on a real rendered screen inside the shell frame.
 */
async function stubShellData(page: Page) {
  await page.route("**/api/masters/companies**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "c1", name: "Zakir Enterprise" }], meta: {} }),
    }),
  );
  await page.route("**/api/masters/financial-years**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "fy1", label: "FY 2025–26", isActive: true }], meta: {} }),
    }),
  );
  await page.route("**/api/ledger/trial-balance**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        totals: { debit: "0.0000", credit: "0.0000" },
        meta: { page: 1, pageSize: 25, total: 0 },
      }),
    }),
  );
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("nav drill to a built screen + persistent collapse rail", async ({ page }) => {
  await stubShellData(page);
  await login(page);

  // Skip link is the first tabbable element.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  // Drill: expand the Ledger module (accordion) → click Trial balance (≤ 2 clicks).
  await page.getByTestId("nav-module-ledger").click();
  await page.getByTestId("nav-item-/ledger/trial-balance").click();
  await page.waitForURL("**/ledger/trial-balance");

  // v3: a flat list page carries NO breadcrumb; the topbar is global-only (the
  // profile block is docked in the sidebar footer, not the topbar).
  await expect(page.getByTestId("breadcrumb")).toHaveCount(0);
  const topbar = page.getByTestId("topbar");
  await expect(topbar.getByTestId("user-menu")).toHaveCount(0);
  await expect(page.getByTestId("sidebar-footer").getByTestId("user-menu")).toBeVisible();

  // Collapse the sidebar to the icon rail; the toggle persists the choice.
  const sidebar = page.getByTestId("sidebar");
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  await page.getByTestId("collapse-toggle").click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");

  // Reload → the collapsed choice persists (localStorage-backed).
  await page.reload();
  await expect(page.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "true");

  // A rail icon exposes the module's flyout on hover, still reaching a built screen.
  await page.getByTestId("nav-rail-ledger").hover();
  await expect(page.getByTestId("nav-flyout-ledger")).toBeVisible();
});
