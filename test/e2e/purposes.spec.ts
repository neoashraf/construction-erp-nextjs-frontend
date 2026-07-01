import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-7 purposes happy path (FR-MAS-011/012/013/029): select project → inline-create a
 * purpose via the combobox → deactivate. Reactivate + rename covered in component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Purpose {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  version: number;
}

async function stub(page: Page, purposes: Purpose[]) {
  let seq = 100;
  const project = {
    id: "proj1",
    projectCode: "P-001",
    name: "Tower A",
    status: "ACTIVE",
    location: null,
    customerId: null,
    projectManagerId: null,
    startDate: "2025-01-01",
    expectedEndDate: "2026-01-01",
    actualEndDate: null,
    isActive: true,
    version: 1,
  };
  await page.route("**/api/masters/projects**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ data, meta: {} }),
      });

    // Purpose endpoints: /projects/:id/purposes[/...]
    const pm = url.pathname.match(
      /\/projects\/[^/]+\/purposes(?:\/([^/]+)\/(deactivate|reactivate))?$/,
    );
    if (pm) {
      const id = pm[1];
      const action = pm[2];
      if (req.method() === "GET") {
        const activeOnly = url.searchParams.get("isActive") === "true";
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        let rows = purposes;
        if (activeOnly) rows = rows.filter((p) => p.isActive);
        if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q));
        return ok(rows);
      }
      if (req.method() === "POST" && !action) {
        const b = JSON.parse(req.postData() || "{}");
        const existing = purposes.find(
          (p) => p.name.toLowerCase() === String(b.name).toLowerCase(),
        );
        if (existing) return ok(existing, 200); // idempotent
        const np: Purpose = {
          id: `pp${(seq += 1)}`,
          projectId: "proj1",
          name: b.name,
          isActive: true,
          version: 1,
        };
        purposes.push(np);
        return ok(np, 201);
      }
      if (req.method() === "POST" && action && id) {
        const p = purposes.find((x) => x.id === id)!;
        p.isActive = action === "reactivate";
        p.version += 1;
        return ok(p);
      }
      return route.fulfill({ status: 204, body: "" });
    }

    // Projects list
    if (req.method() === "GET") return ok([project]);
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

test("Admin inline-creates a purpose then deactivates it", async ({ page }) => {
  const purposes: Purpose[] = [];
  await stub(page, purposes);
  await login(page);
  await page.goto("/master-data/purposes");

  // Project auto-selected → empty list.
  await expect(page.getByText("No purposes for this project yet.")).toBeVisible();

  // Inline-create via the combobox.
  const input = page.getByTestId("purpose-combobox-input");
  await input.click();
  await input.fill("Foundation");
  await page.getByTestId("purpose-create-option").click();
  await expect(page.getByText("‘Foundation’ selected.")).toBeVisible();

  // The purpose now appears in the active list.
  const table = page.getByTestId("purposes-desktop");
  await expect(table.getByText("Foundation")).toBeVisible();

  // Deactivate it.
  await table.getByTestId("purpose-actions-pp101").click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByTestId("purpose-status-confirm").click();
  await expect(page.getByText("‘Foundation’ deactivated.")).toBeVisible();
});
