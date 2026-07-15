import { test, expect, type Page } from "@playwright/test";

/**
 * FE-61 fe-dashboard — happy path (FR-DSH-001/002/005). Load `/dashboard`
 * post-login → change project scope → refresh a tile → click a tile → land
 * on its pre-scoped `/reports/…` report.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Dashboard — load → scope change → refresh a tile → drill into a report", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await expect(page.getByTestId("dashboard-title")).toContainText("Dashboard");
  await expect(page.getByTestId("tile-grid")).toBeVisible();

  // Change project scope.
  await page.getByTestId("dash-project").selectOption("proj-a");
  await expect(page.getByTestId("tile-grid")).toBeVisible();

  // Refresh the low-stock tile.
  await page.getByTestId("tile-low-stock-refresh").click();
  await expect(page.getByTestId("tile-low-stock")).toBeVisible();

  // Drill into a report — click the tile's "View report" link and confirm we
  // land on the mapped /reports/... route.
  const drill = page.getByTestId("tile-project-cash-flow-drill");
  const href = await drill.getAttribute("href");
  expect(href).toContain("/reports/trial-balance-ledgers");
  await drill.click();
  await page.waitForURL(/\/reports\/trial-balance-ledgers/, { timeout: 30_000 });
});
