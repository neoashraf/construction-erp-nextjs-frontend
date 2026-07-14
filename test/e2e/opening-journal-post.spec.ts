import { test, expect, type Page } from "@playwright/test";

/**
 * FE-51 fe-opening-journal — happy path (FR-GEN-009/-015). The mock backend seeds an
 * OPENING voucher already (opn-1), so the wizard renders the read-only recap directly
 * — the exact end state a real post transitions into. Assertions cover the recap +
 * absence of a Post affordance (one-per-company rule).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Opening journal — already-posted seed renders the read-only recap", async ({ page }) => {
  await login(page);
  await page.goto("/contra-journal/opening");
  await expect(page.getByTestId("opening-title")).toContainText("Opening journal");
  await expect(page.getByTestId("opening-posted-recap")).toBeVisible();
  await expect(page.getByTestId("opening-post")).toHaveCount(0);
});
