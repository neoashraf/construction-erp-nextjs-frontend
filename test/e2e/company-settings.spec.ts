import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-2 company-settings happy path (FR-MAS-001/004/032): load → edit identity → save.
 * Auth via the real BFF + mock NestJS; the masters/companies calls are stubbed at the
 * browser with a stateful handler returning the central `{ data, meta }` envelope.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const COMPANY_ID = "11111111-1111-1111-1111-111111111111"; // matches the mock admin's companyId

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  bin: string | null;
  tin: string | null;
  address: string | null;
  currency: string;
  dateFormat: string;
  locale: string;
  isActive: boolean;
  version: number;
}

function seed(): Company {
  return {
    id: COMPANY_ID,
    name: "Zakir Enterprise",
    legalName: "Zakir Enterprise Ltd",
    bin: "4057650345321",
    tin: "654321987012",
    address: "Dhaka, Bangladesh",
    currency: "BDT",
    dateFormat: "DD/MM/YYYY",
    locale: "bn-BD",
    isActive: true,
    version: 1,
  };
}

async function stubCompany(page: Page, company: Company) {
  await page.route("**/api/masters/companies/**", async (route: Route) => {
    const req = route.request();
    const method = req.method();
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: company, meta: { requestId: "t" } }),
      });
    }
    if (method === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      Object.assign(company, {
        name: body.name,
        legalName: body.legalName,
        version: company.version + 1,
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: company, meta: { requestId: "t" } }),
      });
    }
    if (method === "PUT") {
      const body = JSON.parse(req.postData() || "{}");
      Object.assign(company, {
        currency: body.currency,
        dateFormat: body.dateFormat,
        locale: body.locale,
        version: company.version + 1,
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: company, meta: { requestId: "t" } }),
      });
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

test("Admin loads company settings, edits identity, and saves (FR-MAS-004)", async ({ page }) => {
  await stubCompany(page, seed());
  await login(page);
  await page.goto("/master-data/company-settings");

  await expect(page.getByTestId("active-company-badge")).toHaveText("Zakir Enterprise");
  await expect(page.getByText("Zakir Enterprise Ltd")).toBeVisible();

  await page.getByTestId("identity-card-edit").click();
  const name = page.getByLabel(/company name/i);
  await name.fill("Zakir Enterprise Renamed");
  await page.getByTestId("identity-card-save").click();

  await expect(page.getByText("Company details saved.")).toBeVisible();
  // The renamed value shows in both the header badge and the identity card — scope to the card.
  await expect(
    page.getByTestId("identity-card").getByText("Zakir Enterprise Renamed"),
  ).toBeVisible();
});

test("company name is required — save is blocked with an inline message", async ({ page }) => {
  await stubCompany(page, seed());
  await login(page);
  await page.goto("/master-data/company-settings");

  await page.getByTestId("identity-card-edit").click();
  await page.getByLabel(/company name/i).fill("");
  await page.getByTestId("identity-card-save").click();
  await expect(page.getByText("Company name is required.")).toBeVisible();
});
