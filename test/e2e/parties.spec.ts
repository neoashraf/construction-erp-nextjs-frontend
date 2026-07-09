import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-3 parties happy path (FR-MAS-022/023/029): list → new party → save → deactivate.
 * Auth via the real BFF + mock NestJS; masters/parties stubbed at the browser with a
 * stateful handler returning the central `{ data, meta }` envelope.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface P {
  id: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  tin: string | null;
  bin: string | null;
  address: string | null;
  phone: string;
  email: string | null;
  paymentTermsDays: number | null;
  openingBalance: string | null;
  isActive: boolean;
  version: number;
}

async function stubParties(page: Page, store: P[]) {
  let seq = 100;
  await page.route("**/api/masters/parties**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const idMatch = url.pathname.match(/\/parties\/([^/]+)(?:\/(deactivate|reactivate))?$/);
    const id = idMatch?.[1];
    const action = idMatch?.[2];

    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: { total: store.length, page: 1, pageSize: 25 } }),
      });

    if (method === "GET" && !id) {
      // list — apply the isActive filter minimally
      const activeOnly = url.searchParams.get("isActive") === "true";
      const rows = activeOnly ? store.filter((p) => p.isActive) : store;
      return ok(rows);
    }
    if (method === "GET" && id) {
      return ok(store.find((p) => p.id === id));
    }
    if (method === "POST" && !action) {
      const b = JSON.parse(req.postData() || "{}");
      const np: P = { id: `p${(seq += 1)}`, ...b, isActive: true, version: 1 };
      store.push(np);
      return ok({ id: np.id }, 201);
    }
    if (method === "POST" && action && id) {
      const p = store.find((x) => x.id === id)!;
      p.isActive = action === "reactivate";
      p.version += 1;
      return ok(p);
    }
    if (method === "PATCH" && id) {
      const b = JSON.parse(req.postData() || "{}");
      const p = store.find((x) => x.id === id)!;
      Object.assign(p, b, { version: p.version + 1 });
      return ok(p);
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

test("Admin creates a party then deactivates it (FR-MAS-022/023/029)", async ({ page }) => {
  const store: P[] = [];
  await stubParties(page, store);
  await login(page);

  await page.goto("/master-data/parties");
  await expect(page.getByText("No parties yet.")).toBeVisible();

  // Create — opens the right-side drawer in place (no navigation).
  await page.getByTestId("empty-new-party").click();
  const sheet = page.getByTestId("party-form-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(/^name/i).fill("Acme Traders");
  await sheet.getByRole("checkbox", { name: /customer/i }).click();
  await sheet.getByLabel(/phone/i).fill("01712345678");
  await sheet.getByTestId("party-save").click();
  await expect(page.getByText("Party created.")).toBeVisible();
  // Drawer closes on success and we stay on the list.
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/master-data\/parties$/);

  // Deactivate the new row via its kebab menu.
  const row = page.getByTestId("party-row-p101");
  await row.getByTestId("party-actions-p101").click();
  await page.getByRole("menuitem", { name: /deactivate/i }).click();
  const dialog = page.getByTestId("party-status-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("party-status-confirm").click();
  await expect(page.getByText("‘Acme Traders’ deactivated.")).toBeVisible();
});

test("at least one role is required to save a new party", async ({ page }) => {
  await stubParties(page, []);
  await login(page);
  await page.goto("/master-data/parties/new");
  await page.getByLabel(/party name/i).fill("No Role Co");
  await page.getByLabel(/phone/i).fill("01712345678");
  await page.getByTestId("party-save").click();
  await expect(page.getByTestId("roles-error")).toHaveText(
    "Select at least one role (customer or supplier).",
  );
});
