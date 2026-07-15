import { test, expect, type Page } from "@playwright/test";

/**
 * FE-57 fe-project-ipc-reports — happy path (FR-RPT-015/-016/-017/-029). Open
 * the viewer → run Project P&L with a required project → see the Project total
 * row → switch to IPC report → see ageing badges + the cumulative footer →
 * Export to Excel triggers a download.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Project & IPC — P&L (required project) → IPC ageing + cumulative → export Excel", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/reports/project-ipc");
  await expect(page.getByTestId("pi-title")).toContainText("Project");

  // The required-project blocker is visible before a project is picked.
  await expect(page.getByTestId("pi-project-required")).toBeVisible();

  // Pick a project + range and Run Project P&L.
  await page.getByTestId("param-project").selectOption("proj-a");
  await page.getByTestId("param-date-from").fill("2026-04-01");
  await page.getByTestId("param-date-to").fill("2026-06-30");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("pi-pnl-table")).toBeVisible();
  await expect(page.getByTestId("pi-pnl-project-total-row")).toContainText("Project total");
  await expect(page.getByTestId("pi-pnl-totals-footer")).toBeVisible();

  // Switch to IPC report — project is preserved across tabs.
  await page.getByTestId("pi-tab-IPC_BILLING").click();
  await expect(page.getByTestId("param-project")).toHaveValue("proj-a");
  await page.getByTestId("report-run").click();
  await expect(page.getByTestId("pi-ipc-table")).toBeVisible();

  // Ageing badges visible (label + colour).
  await expect(page.getByTestId("ipc-ageing-CURRENT").first()).toContainText("Current");
  await expect(page.getByTestId("pi-ipc-cumulative-footer")).toContainText("Project cumulative");
  await expect(page.getByTestId("pi-ipc-bin-tin-note")).toBeVisible();

  // Excel export triggers a browser download.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export-excel").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
