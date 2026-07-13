import { test, expect, type Page } from "@playwright/test";

/**
 * FE-29 Requisition entry happy path (FR-REQ-001/-005/-006): create a DRAFT → add a line →
 * save → submit → land on the list with the allocated requisitionNo. Runs against the
 * production build with the in-process mock NestJS (logged in as Admin — full REQ access).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("requisition — list loads with seeded rows", async ({ page }) => {
  await login(page);
  await page.goto("/requisitions");
  await expect(page.getByTestId("req-list-title")).toHaveText("Requisitions");
  await expect(page.getByTestId("req-list")).toBeVisible();
  await expect(page.getByTestId("req-status-SUBMITTED").first()).toBeVisible();
});

test("requisition — create draft, add line, save, submit", async ({ page }) => {
  await login(page);
  await page.goto("/requisitions/new");
  await expect(page.getByTestId("req-form-title")).toHaveText("New requisition");

  await page.getByTestId("req-project").selectOption("proj-a");
  await page.getByTestId("req-cost-centre").selectOption("cc-mat");
  await expect(page.getByTestId("req-purpose")).toBeEnabled();
  await page.getByTestId("req-purpose").selectOption("pp-1");
  await page.getByLabel(/Required date/i).fill("20/07/2026");
  await page.getByTestId("req-line-item").first().selectOption("it-cement");
  await page.getByTestId("req-line-qty").first().fill("100");

  // Save draft → navigates to the saved requisition (edit mode).
  await page.getByTestId("req-save").click();
  await page.waitForURL(/\/requisitions\/req-/);

  // Submit behind the confirm dialog → lands back on the list.
  await page.getByTestId("req-submit").click();
  await expect(page.getByTestId("req-submit-dialog")).toBeVisible();
  await page.getByTestId("req-submit-confirm").click();
  await page.waitForURL(/\/requisitions$/);
  await expect(page.getByTestId("req-list")).toBeVisible();
});
