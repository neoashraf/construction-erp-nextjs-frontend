import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-4 chart-of-accounts happy path (FR-MAS-017/018/019): tree → new group → new
 * account → save. Auth via the real BFF + mock NestJS; account-groups + accounts
 * stubbed at the browser with a stateful handler ({ data, meta } envelope).
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface G {
  id: string;
  name: string;
  parentGroupId: string | null;
  type: string;
  version: number;
}
interface A {
  id: string;
  code: string;
  name: string;
  accountGroupId: string;
  type: string;
  openingBalance: string | null;
  isActive: boolean;
  version: number;
}

async function stubCoa(page: Page, groups: G[], accounts: A[]) {
  let gseq = 100;
  let aseq = 100;
  await page.route("**/api/masters/account-groups**", async (route: Route) => {
    const req = route.request();
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: {} }),
      });
    if (req.method() === "GET") return ok(groups);
    if (req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      const g: G = {
        id: `g${(gseq += 1)}`,
        name: b.name,
        parentGroupId: b.parentGroupId ?? null,
        type: b.type,
        version: 1,
      };
      groups.push(g);
      return ok({ id: g.id }, 201);
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/masters/accounts**", async (route: Route) => {
    const req = route.request();
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: {} }),
      });
    if (req.method() === "GET") return ok(accounts);
    if (req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      const a: A = {
        id: `a${(aseq += 1)}`,
        code: b.code,
        name: b.name,
        accountGroupId: b.accountGroupId,
        type: b.type,
        openingBalance: b.openingBalance ?? null,
        isActive: true,
        version: 1,
      };
      accounts.push(a);
      return ok({ id: a.id }, 201);
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

test("Admin creates a group then an account under it (FR-MAS-017/018/019)", async ({ page }) => {
  const groups: G[] = [
    { id: "g1", name: "Assets", parentGroupId: null, type: "ASSET", version: 1 },
  ];
  const accounts: A[] = [];
  await stubCoa(page, groups, accounts);
  await login(page);

  await page.goto("/master-data/chart-of-accounts");
  await expect(page.getByTestId("group-node-g1")).toBeVisible();

  // New group
  await page.getByTestId("new-group").click();
  await page.getByLabel(/group name/i).fill("Current Assets");
  await page.getByLabel(/parent group/i).selectOption("g1");
  await page.getByLabel(/^type/i).selectOption("ASSET");
  await page.getByTestId("group-save").click();
  await expect(page.getByText("Group created.")).toBeVisible();

  // New account under the new group — Type auto-set from the group
  await page.getByTestId("new-account").click();
  await page.getByLabel(/code/i).fill("1100");
  await page.getByLabel(/name/i).fill("Cash in Hand");
  await page.getByLabel(/group/i).selectOption("g101");
  await expect(page.getByTestId("derived-type")).toContainText("Asset");
  await page.getByTestId("account-save").click();
  await expect(page.getByText("Account created.")).toBeVisible();

  // Search reveals the new account in the flat list
  await page.getByLabel(/search accounts/i).fill("1100");
  await expect(page.getByText("Cash in Hand")).toBeVisible();
});

test("account code is required to save", async ({ page }) => {
  const groups: G[] = [
    { id: "g1", name: "Assets", parentGroupId: null, type: "ASSET", version: 1 },
  ];
  await stubCoa(page, groups, []);
  await login(page);
  await page.goto("/master-data/chart-of-accounts");
  await page.getByTestId("new-account").click();
  await page.getByLabel(/name/i).fill("No Code");
  await page.getByLabel(/group/i).selectOption("g1");
  await page.getByTestId("account-save").click();
  await expect(page.getByTestId("code-error")).toHaveText("Account code is required.");
});
