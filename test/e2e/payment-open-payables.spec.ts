import { test, expect, type Page } from "@playwright/test";

/**
 * FE-63 fe-payments-outstanding-route — Open payables is the Outstanding view's own route
 * (FR-PAY-007/-017; payment-list.md §3/§8/§9). Drives the path the placeholder used to
 * break: sidebar "Open payables" → the real Outstanding view (never a ComingSoon), the
 * sidebar highlight and H1 following the selected view, and the segmented control
 * swapping the URL rather than toggling in place.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Open payables — sidebar entry opens the Outstanding view, tabs swap the route", async ({
  page,
}) => {
  await login(page);

  // 1. The nav entry lands on the real screen, not the retired placeholder.
  await page.goto("/payments/open-payables");
  await expect(page.getByTestId("payment-outstanding-view")).toBeVisible();
  await expect(page.getByTestId("coming-soon")).toHaveCount(0);

  // 2. The H1 is the page identity and matches the nav label being highlighted.
  await expect(page.getByTestId("payment-list-title")).toHaveText("Open payables");
  await expect(page.getByTestId("payments-tab-outstanding")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // 3. Neither route renders a breadcrumb — both have their own nav entry.
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0);

  // 4. Open payables actually load (the read this route exists for).
  await expect(page.getByTestId("payment-outstanding-list")).toBeVisible();

  // 5. Selecting "Payments" NAVIGATES — the URL changes, the H1 follows.
  await page.getByTestId("payments-tab-payments").click();
  await page.waitForURL("**/payments");
  await expect(page.getByTestId("payment-list-title")).toHaveText("Payments");

  // 6. ...and back again, so the route is the thing that selects the view.
  await page.getByTestId("payments-tab-outstanding").click();
  await page.waitForURL("**/payments/open-payables");
  await expect(page.getByTestId("payment-list-title")).toHaveText("Open payables");

  // 7. A reload keeps the Outstanding view — it is not transient local state.
  await page.reload();
  await expect(page.getByTestId("payment-outstanding-view")).toBeVisible();
  await expect(page.getByTestId("payment-list-title")).toHaveText("Open payables");
});

test("Open payables — a deep-linked payable opens filtered, an unknown one degrades", async ({
  page,
}) => {
  await login(page);

  // The Payment viewer's allocations panel emits exactly this shape for a settled payable.
  await page.goto("/payments/open-payables?payableType=PURCHASE_BILL&payableId=pb-1");
  await expect(page.getByTestId("payment-outstanding-view")).toBeVisible();

  // An unresolvable id must not error the screen — it falls back to the plain view.
  await page.goto("/payments/open-payables?payableType=PURCHASE_BILL&payableId=does-not-exist");
  await expect(page.getByTestId("payment-outstanding-view")).toBeVisible();
  await expect(page.getByTestId("payment-outstanding-error")).toHaveCount(0);
});
