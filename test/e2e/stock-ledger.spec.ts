import { test, expect, type Page } from "@playwright/test";

/**
 * FE-28 Stock Ledger happy path (FR-INV-001/004/006/021): load balances → group toggle →
 * open a balance's movement history → follow its Stock Journal source link. Runs against the
 * production build with the in-process mock NestJS (logged in as Admin — sees all godowns).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("stock ledger — balances, grouping, movement drill + source link", async ({ page }) => {
  await login(page);
  await page.goto("/inventory/stock-ledger");

  await expect(page.getByTestId("sl-title")).toHaveText("Stock Ledger");
  await expect(page.getByTestId("sl-balances")).toBeVisible();

  // Grouping toggle switches selection client-side.
  await page.getByTestId("sl-group-item").click();
  await expect(page.getByTestId("sl-group-item")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("sl-group-godown").click();

  // Open the movement history for the first balance.
  await page.getByTestId("sl-view").first().click();
  await expect(page.getByTestId("sl-movement-panel")).toBeVisible();
  await expect(page.getByTestId("sl-movement-title")).toContainText("Movement history —");

  // A Stock Journal source link routes to the Stock Journal viewer.
  const sjLink = page.getByTestId("sl-source-STOCK_JOURNAL").first();
  await expect(sjLink).toHaveAttribute("href", /\/inventory\/stock-journals\//);
});

test("stock ledger — a filtered-to-nothing balance shows the filtered empty state", async ({ page }) => {
  await login(page);
  await page.goto("/inventory/stock-ledger");
  await expect(page.getByTestId("sl-balances")).toBeVisible();

  // Yard godown (proj-c) has no seeded balances → filtered empty.
  await page.getByTestId("sl-f-godown").selectOption("gd-d");
  await page.getByTestId("sl-f-apply").click();
  await expect(page.getByTestId("sl-empty-filtered")).toBeVisible();
});
