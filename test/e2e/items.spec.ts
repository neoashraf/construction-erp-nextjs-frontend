import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-8 items happy path (FR-MAS-025/026/034): create item → add UoM conversion →
 * base unit locks. Deactivate/reactivate covered in the component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Item {
  id: string;
  code: string;
  name: string;
  baseUom: string;
  hsCode: string | null;
  defaultAccountId: string | null;
  isActive: boolean;
  version: number;
}
interface Conv {
  id: string;
  itemId: string;
  uom: string;
  factorToBase: string;
}

async function stub(page: Page, items: Item[], convs: Conv[]) {
  let iseq = 100;
  let cseq = 100;
  const account = {
    id: "acc1",
    code: "5100",
    name: "Material Expense",
    accountGroupId: "g1",
    type: "EXPENSE",
    openingBalance: null,
    isActive: true,
    version: 1,
  };

  await page.route("**/api/masters/accounts**", async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [account], meta: {} }),
    }),
  );

  await page.route("**/api/masters/items**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: { total: items.length } }),
      });

    const conv = url.pathname.match(/\/items\/([^/]+)\/uom-conversions(?:\/([^/]+))?$/);
    if (conv) {
      const itemId = conv[1]!;
      const convId = conv[2];
      if (req.method() === "GET") return ok(convs.filter((c) => c.itemId === itemId));
      if (req.method() === "PUT") {
        const b = JSON.parse(req.postData() || "{}");
        let row = convs.find(
          (c) => c.itemId === itemId && c.uom.toLowerCase() === String(b.uom).toLowerCase(),
        );
        if (row) row.factorToBase = b.factorToBase;
        else {
          row = { id: `cv${(cseq += 1)}`, itemId, uom: b.uom, factorToBase: b.factorToBase };
          convs.push(row);
        }
        return ok(row);
      }
      if (req.method() === "DELETE") {
        const idx = convs.findIndex((c) => c.id === convId);
        if (idx >= 0) convs.splice(idx, 1);
        return route.fulfill({ status: 204, body: "" });
      }
    }

    const idm = url.pathname.match(/\/items\/([^/]+)$/);
    const id = idm?.[1];
    if (req.method() === "GET" && id && id !== "new") {
      const it = items.find((x) => x.id === id)!;
      return ok({ ...it, hasTransactions: false });
    }
    if (req.method() === "GET" && !id) return ok(items);
    if (req.method() === "POST" && !url.pathname.includes("uom")) {
      const b = JSON.parse(req.postData() || "{}");
      const it: Item = {
        id: `it${(iseq += 1)}`,
        code: b.code,
        name: b.name,
        baseUom: b.baseUom,
        hsCode: b.hsCode ?? null,
        defaultAccountId: b.defaultAccountId ?? null,
        isActive: true,
        version: 1,
      };
      items.push(it);
      return ok({ id: it.id }, 201);
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

test("Admin creates an item, adds a conversion, and the base unit locks", async ({ page }) => {
  const items: Item[] = [];
  const convs: Conv[] = [];
  await stub(page, items, convs);
  await login(page);

  await page.goto("/master-data/items/new");
  await page.getByLabel(/^code/i).fill("MAT-1");
  await page.getByLabel(/^name/i).fill("Cement");
  await page.getByLabel(/base unit/i).fill("Bag");
  await page.getByLabel(/default gl account/i).selectOption("acc1");
  await page.getByTestId("item-save").click();

  // Navigated to the created item's detail.
  await page.waitForURL(/\/master-data\/items\/it101$/);
  await expect(page.getByTestId("conversions-empty")).toContainText("The base unit is Bag");

  // Base unit editable before conversions exist.
  await expect(page.getByLabel(/base unit/i)).toBeEnabled();

  // Add a conversion.
  await page.getByLabel(/^unit/i).fill("Ton");
  await page.getByLabel(/factor to/i).fill("20");
  await page.getByTestId("conversion-save").click();
  await expect(page.getByText("Conversion for Ton saved.")).toBeVisible();
  await expect(page.getByTestId("conversions-list")).toContainText("1 Ton = 20.0000 Bag");

  // Base unit now locked with the immutability note.
  await expect(page.getByTestId("base-uom-locked-note")).toBeVisible();
  await expect(page.getByLabel(/base unit/i)).toBeDisabled();
});
