import { test, expect, type Page } from "@playwright/test";

/**
 * FE-36 Attendance — office biometric import + reconciliation (FR-HR-004; edge §12.9). Admin
 * picks a project, opens the biometric import, and pastes a feed for emp-1 today. The mock
 * already has a manual emp-1 row for today, so the server imports the non-conflicting rows and
 * reports the clashing day as skipped (ALREADY_RECORDED) — never silently doubling the day.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Office biometric import — reports the already-recorded day as skipped", async ({ page }) => {
  await login(page);
  await page.goto("/hr/attendance");
  await expect(page.getByTestId("attendance-title")).toHaveText("Attendance");

  // The import needs a top-level project — pick one and Apply.
  await page.getByTestId("att-project").selectOption("proj-a");
  await page.getByTestId("attendance-filter-apply").click();

  // Default mode is OFFICE; open the biometric import panel.
  await page.getByTestId("office-toggle-import").click();
  await expect(page.getByTestId("biometric-import-panel")).toBeVisible();

  // Feed emp-1 today — the mock seeds emp-1 MANUAL for the current date, so this clashes.
  const today = new Date().toISOString().slice(0, 10);
  const feed = JSON.stringify([
    { employeeCode: "emp-1", attendanceDate: today, checkIn: "08:55", checkOut: "17:45", dayStatus: "PRESENT" },
  ]);

  await page.getByTestId("biometric-json").fill(feed);
  await page.getByTestId("biometric-import").click();

  const panel = page.getByTestId("reconciliation-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("reconciliation-heading")).toContainText("skipped");
  await expect(panel.getByTestId("reconciliation-item")).toContainText(today);

  // Dismiss the summary.
  await panel.getByTestId("reconciliation-done").click();
  await expect(page.getByTestId("reconciliation-panel")).toHaveCount(0, { timeout: 10_000 });
});
