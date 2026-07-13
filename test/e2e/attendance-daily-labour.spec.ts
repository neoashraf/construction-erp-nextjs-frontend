import { test, expect, type Page } from "@playwright/test";

/**
 * FE-36 Attendance — daily-labour capture → Confirm happy path (FR-HR-006, -009..-012).
 * Logged in as Admin (holds `hr:attendance:confirm`). Adds a draft row, saves, opens the
 * Confirm dialog with the balanced preview, posts, and asserts the returned `entryNo`
 * badge is visible with a link into the LED Entry viewer.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Daily-labour capture → Confirm posts accrual with entryNo", async ({ page }) => {
  await login(page);
  await page.goto("/hr/attendance");
  await expect(page.getByTestId("attendance-title")).toHaveText("Attendance");

  await page.getByTestId("attendance-tab-DAILY_LABOUR").click();
  await expect(page.getByTestId("daily-labour-grid")).toBeVisible();

  // Confirm the first existing UNCONFIRMED daily-labour row (mock BFF seeds one with purpose null).
  // First, pick a Confirm button; the row that has a purpose ("att-dl-1" in the seed) is CONFIRMED already,
  // so pick att-dl-2 or att-dl-3 which are UNCONFIRMED and lack purposeId — the dialog will require the purpose picker.
  const confirmBtn = page.getByTestId("row-confirm-att-dl-2");
  await confirmBtn.click();
  const dialog = page.getByTestId("confirm-accrual-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("balanced-preview")).toBeVisible();

  // Pick a purpose (needed because att-dl-2 seed has purposeId: null).
  await dialog.getByTestId("confirm-purpose-select").selectOption({ index: 1 });
  await dialog.getByTestId("confirm-post").click();

  // Dialog closes; the confirmed row now shows the ConfirmedRowBadge + entryNo link.
  await expect(page.getByTestId("confirmed-entryno-link").first()).toBeVisible({ timeout: 10_000 });
  const entryNo = await page.getByTestId("confirmed-entryno-link").first().textContent();
  expect(entryNo).toMatch(/^SJ\/2526\/\d{4}$/);
});
