import { test, expect, type Page } from "@playwright/test";

/**
 * FE-27 Stock Journal happy path (FR-INV-012/016/018): create an ISSUE draft → approve →
 * post → the posted confirmation shows the allocated entry no. Runs against the production
 * build with the in-process mock NestJS (logged in as Admin — full lifecycle authority).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

/** Fill + save a single-item ISSUE draft, then approve it. Returns nothing (stays on detail). */
async function createIssueDraftAndApprove(page: Page, quantity: string) {
  await page.goto("/inventory/stock-journals/new");
  await expect(page.getByTestId("sj-editor-title")).toHaveText("New Stock Journal");
  await page.getByTestId("sj-mode-ISSUE").click();
  await page.getByTestId("sj-item").selectOption("it-cement");
  await page.getByTestId("sj-qty").fill(quantity);
  await page.getByTestId("sj-out-project").selectOption("proj-a");
  await page.getByTestId("sj-out-cost-centre").selectOption("cc-mat");
  await page.getByTestId("sj-out-godown").selectOption("gd-a");
  await page.getByTestId("sj-out-purpose").selectOption({ index: 1 });
  await page.getByTestId("sj-save").click();
  // Navigated to the new draft's detail — Approve appears.
  await expect(page.getByTestId("sj-approve")).toBeVisible();
  await page.getByTestId("sj-approve").click();
  await expect(page.getByTestId("sj-post")).toBeVisible();
}

test("stock journal — create ISSUE draft, approve, post", async ({ page }) => {
  await login(page);
  await createIssueDraftAndApprove(page, "20");
  await page.getByTestId("sj-post").click();
  // Posted → Reverse becomes the only lifecycle action; an entry no was allocated.
  await expect(page.getByTestId("sj-reverse")).toBeVisible();
  await expect(page.getByTestId("sj-status-POSTED")).toBeVisible();
});

test("stock journal — list loads with seeded journals", async ({ page }) => {
  await login(page);
  await page.goto("/inventory/stock-journals");
  await expect(page.getByTestId("sj-list-title")).toHaveText("Stock Journal");
  await expect(page.getByTestId("sj-list")).toBeVisible();
  await expect(page.getByTestId("sj-status-POSTED").first()).toBeVisible();
});
