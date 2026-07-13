import { test, expect, type Page } from "@playwright/test";

/**
 * FE-39 Purchase Orders approve happy path (FR-PUR-001/-002). Logged in as Admin, creates a
 * DRAFT PO end-to-end: header (project + supplier + PO date), one line with the four
 * dimensions (item + qty + rate + godown + cost centre + purpose), Save → Approve behind
 * the confirm dialog. The PO flips read-only and the APPROVED badge is visible. Runs
 * against the production build with the in-process mock NestJS (USE_MOCK_NESTJS).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("PO list — loads with the seeded rows + New PO CTA", async ({ page }) => {
  await login(page);
  await page.goto("/purchase/orders");
  await expect(page.getByTestId("po-list-title")).toHaveText("Purchase orders");
  await expect(page.getByTestId("po-list")).toBeVisible();
  await expect(page.getByTestId("po-new")).toBeVisible();
});

test("PO editor — create draft, save, approve behind the confirm dialog", async ({ page }) => {
  await login(page);
  await page.goto("/purchase/orders/new");
  await expect(page.getByTestId("po-form-title")).toHaveText("New purchase order");

  // Header.
  await page.getByTestId("po-project").selectOption("proj-a");
  await page.getByTestId("po-supplier").selectOption("pa-1");
  await page.getByLabel(/^PO date/, { exact: true }).fill("13/07/2026");

  // First line (four dimensions + qty + rate).
  await page.getByTestId("po-line-item").first().selectOption("it-cement");
  await page.getByTestId("po-line-qty").first().fill("120");
  await page.getByTestId("po-line-rate").first().fill("520");
  await page.getByTestId("po-line-godown").first().selectOption("gd-a");
  await page.getByTestId("po-line-cc").first().selectOption("cc-mat");
  await page.getByTestId("po-line-purpose").first().selectOption("pp-1");

  // Total strip reflects 120 × 520 = 62,400.
  await expect(page.getByTestId("po-total")).toContainText("62,400");

  // Save draft — redirects to the persisted detail route.
  await page.getByTestId("po-save").click();
  await page.waitForURL(/\/purchase\/orders\/po-\d+$/);

  // Approve behind the confirm dialog (server-confirmed, no optimistic flip).
  await page.getByTestId("po-approve").click();
  await expect(page.getByTestId("po-approve-dialog")).toBeVisible();
  await page.getByTestId("po-approve-confirm").click();

  // The PO flips read-only and shows the APPROVED badge.
  await expect(page.getByTestId("po-status-APPROVED").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("po-readonly-banner")).toBeVisible();
});
