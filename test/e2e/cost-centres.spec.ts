import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-6 cost-centres happy path (FR-MAS-010/029): add → deactivate (end to end through
 * the guarded route). Reactivate + the rest are covered in the component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface C {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  version: number;
}

async function stub(page: Page, store: C[]) {
  let seq = 100;
  await page.route("**/api/masters/cost-centres**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = url.pathname.match(/\/cost-centres\/([^/]+)(?:\/(deactivate|reactivate))?$/);
    const id = m?.[1];
    const action = m?.[2];
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: { total: store.length } }),
      });

    if (req.method() === "GET" && !id) {
      const activeOnly = url.searchParams.get("isActive") === "true";
      return ok(activeOnly ? store.filter((c) => c.isActive) : store);
    }
    if (req.method() === "POST" && !action) {
      const b = JSON.parse(req.postData() || "{}");
      const c: C = {
        id: `cc${(seq += 1)}`,
        code: b.code,
        name: b.name,
        isActive: true,
        version: 1,
      };
      store.push(c);
      return ok({ id: c.id }, 201);
    }
    if (req.method() === "POST" && action && id) {
      const c = store.find((x) => x.id === id)!;
      c.isActive = action === "reactivate";
      c.version += 1;
      return ok(c);
    }
    return route.fulfill({ status: 204, body: "" });
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Admin adds then deactivates a cost centre", async ({ page }) => {
  const store: C[] = [];
  await stub(page, store);
  await login(page);
  await page.goto("/master-data/cost-centres");
  await expect(page.getByText("No cost centres found.")).toBeVisible();

  // Add
  await page.getByTestId("empty-new-cc").click();
  await page.getByLabel(/code/i).fill("CC-100");
  await page.getByLabel(/name/i).fill("Head Office");
  await page.getByTestId("cost-centre-save").click();
  await expect(page.getByText("Cost centre created.")).toBeVisible();
  const table = page.getByTestId("cc-desktop");
  await expect(table.getByText("CC-100")).toBeVisible();

  // View All up front so the row persists through deactivate → reactivate.
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(table.getByText("CC-100")).toBeVisible();

  // Deactivate (row stays under All, becomes Inactive)
  await table.getByTestId("cc-actions-cc101").click({ force: true });
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByTestId("cost-centre-status-confirm").click();
  await expect(page.getByText("‘Head Office’ deactivated.")).toBeVisible();
  // The row is now Inactive under the All view (deactivate = soft, never deleted).
  await expect(table.locator('[aria-label="Inactive cost centre"]')).toBeVisible();
});
