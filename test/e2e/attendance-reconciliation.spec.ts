import { test, expect, type Page } from "@playwright/test";

/**
 * FE-36 Attendance — office biometric reconciliation (FR-HR-004; edge §12.9). Admin pastes a
 * biometric feed that conflicts with the seeded manual entry (emp-1 today) → the reconciliation
 * panel lists the conflict → "Keep manual" / "Keep imported" applies the resolution and
 * completes without silently doubling the day.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Office biometric reconciliation — Keep manual / Keep imported", async ({ page }) => {
  await login(page);
  await page.goto("/hr/attendance");
  await expect(page.getByTestId("attendance-title")).toHaveText("Attendance");

  // Default mode is OFFICE.
  await expect(page.getByTestId("biometric-import-panel")).toBeVisible();

  // Compose a conflicting feed for emp-1 today (the mock seeds emp-1 MANUAL for the current date).
  const today = new Date().toISOString().slice(0, 10);
  const feed = JSON.stringify([
    {
      employeeId: "emp-1",
      attendanceDate: today,
      projectId: "proj-a",
      checkIn: "08:55",
      checkOut: "17:45",
      dayStatus: "PRESENT",
    },
  ]);

  await page.getByTestId("biometric-json").fill(feed);
  await page.getByTestId("biometric-import").click();

  const panel = page.getByTestId("reconciliation-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("reconciliation-heading")).toContainText("conflict");
  await panel.getByTestId("keep-imported-emp-1").click();
  await panel.getByTestId("reconciliation-apply").click();

  // Panel disappears once resolutions saved.
  await expect(page.getByTestId("reconciliation-panel")).toHaveCount(0, { timeout: 10_000 });
});
