import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-9 projects happy path (FR-MAS-005/006/007/014): create project → activate →
 * add budget → add godown. Close/reopen + deactivate covered in component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Project {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  location: string | null;
  customerId: string | null;
  projectManagerId: string | null;
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
  isActive: boolean;
  version: number;
}

async function stub(page: Page, projects: Project[], budgets: any[], godowns: any[]) {
  let pseq = 100,
    bseq = 100,
    gseq = 100;
  const customer = {
    id: "cust1",
    name: "ACME",
    isCustomer: true,
    isSupplier: false,
    tin: null,
    bin: null,
    address: null,
    phone: "+8801700000000",
    email: null,
    paymentTermsDays: null,
    openingBalance: null,
    isActive: true,
    version: 1,
  };
  const cc = { id: "cc1", code: "CC-100", name: "Head Office", isActive: true, version: 1 };
  const pm = {
    id: "pm1",
    name: "Rahim",
    email: "pm@ze.test",
    role: "PROJECT_MANAGER",
    isActive: true,
  };
  const ok = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: {} }),
    });

  await page.route("**/api/masters/parties**", (r) => ok(r, [customer]));
  await page.route("**/api/masters/cost-centres**", (r) => ok(r, [cc]));
  await page.route("**/api/users**", (r) => ok(r, [pm]));
  await page.route("**/api/masters/godowns**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "GET") return ok(route, godowns);
    if (req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      const g = {
        id: `gd${(gseq += 1)}`,
        projectId: b.projectId,
        name: b.name,
        location: b.location ?? null,
        isActive: true,
        version: 1,
      };
      godowns.push(g);
      return ok(route, { id: g.id }, 201);
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/masters/projects**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const budgetM = url.pathname.match(/\/projects\/([^/]+)\/budgets(?:\/([^/]+))?$/);
    if (budgetM) {
      if (req.method() === "GET") return ok(route, budgets);
      if (req.method() === "PUT") {
        const b = JSON.parse(req.postData() || "{}");
        const row = {
          id: `bd${(bseq += 1)}`,
          projectId: budgetM[1],
          costCentreId: b.costCentreId,
          budgetedAmount: b.budgetedAmount,
        };
        budgets.push(row);
        return ok(route, row);
      }
      return route.fulfill({ status: 204, body: "" });
    }
    const statusM = url.pathname.match(/\/projects\/([^/]+)\/status$/);
    if (statusM && req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      const p = projects.find((x) => x.id === statusM[1])!;
      p.status =
        b.action === "activate"
          ? "ACTIVE"
          : b.action === "close"
            ? "CLOSED"
            : b.action === "hold"
              ? "ON_HOLD"
              : "ACTIVE";
      p.version += 1;
      return ok(route, p);
    }
    const idM = url.pathname.match(/\/projects\/([^/]+)$/);
    const id = idM?.[1];
    if (req.method() === "GET" && id && id !== "new")
      return ok(
        route,
        projects.find((x) => x.id === id),
      );
    if (req.method() === "GET" && !id) return ok(route, projects);
    if (req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      const p: Project = {
        id: `pr${(pseq += 1)}`,
        projectCode: b.projectCode,
        name: b.name,
        status: "PLANNED",
        location: b.location ?? null,
        customerId: b.customerId,
        projectManagerId: b.projectManagerId,
        startDate: b.startDate,
        expectedEndDate: b.expectedEndDate,
        actualEndDate: null,
        isActive: true,
        version: 1,
      };
      projects.push(p);
      return ok(route, { id: p.id }, 201);
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

test("Admin creates a project, activates it, adds a budget and a godown", async ({ page }) => {
  const projects: Project[] = [];
  await stub(page, projects, [], []);
  await login(page);

  await page.goto("/master-data/projects/new");
  await page.getByLabel(/project code/i).fill("P-001");
  await page.getByLabel(/^name/i).fill("Tower A");
  await page.getByLabel(/^customer/i).selectOption("cust1");
  await page.getByLabel(/project manager/i).selectOption("pm1");
  await page.getByLabel(/start date/i).fill("01/07/2025");
  await page.getByLabel(/expected end date/i).fill("30/06/2026");
  await page.getByTestId("project-save").click();

  await page.waitForURL(/\/master-data\/projects\/pr101$/);
  await expect(page.getByLabel(/Status: Planned/i)).toBeVisible();

  // Activate (non-confirm transition)
  await page.getByTestId("status-activate").click();
  await expect(page.getByText("Project activated.")).toBeVisible();

  // Budgets tab → add a budget
  await page.getByTestId("tab-budgets").click();
  await expect(page.getByTestId("budgets-empty")).toBeVisible();
  await page.getByLabel(/cost centre/i).selectOption("cc1");
  await page.getByLabel(/budgeted amount/i).fill("500000");
  await page.getByTestId("budget-save").click();
  await expect(page.getByText("Budget saved.")).toBeVisible();

  // Godowns tab → add a godown
  await page.getByTestId("tab-godowns").click();
  await expect(page.getByTestId("godowns-empty")).toBeVisible();
  await page.getByLabel(/^name/i).fill("Main Store");
  await page.getByTestId("godown-save").click();
  await expect(page.getByText("Godown saved.")).toBeVisible();
});
