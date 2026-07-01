import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-5 financial-year manager happy path (FR-MAS-002/003): list → create → set-active.
 * Auth goes through the real BFF + in-process mock NestJS (login sets the session
 * cookie the server guard reads). The `/api/masters/financial-years` calls are
 * intercepted at the browser with a small stateful stub returning the central
 * response model `{ data, meta }`, so the screen is exercised without a live masters API.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface FY {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  version: number;
}

function seedYears(): FY[] {
  return [
    {
      id: "fy1",
      label: "2024-25",
      startDate: "2024-07-01",
      endDate: "2025-06-30",
      isActive: false,
      version: 1,
    },
    {
      id: "fy2",
      label: "2025-26",
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      isActive: true,
      version: 3,
    },
  ];
}

/** Install a stateful stub for the masters FY endpoints on this page. */
async function stubFinancialYears(page: Page, years: FY[]) {
  let seq = 100;
  await page.route("**/api/masters/financial-years**", async (route: Route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: years, meta: { requestId: "test" } }),
      });
    }

    if (method === "POST" && url.endsWith("/set-active")) {
      const id = url.match(/financial-years\/([^/]+)\/set-active/)?.[1];
      years.forEach((y) => (y.isActive = y.id === id));
      const now = years.find((y) => y.id === id)!;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: now, meta: { requestId: "test" } }),
      });
    }

    if (method === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      const id = `fy${(seq += 1)}`;
      years.push({
        id,
        label: body.label,
        startDate: body.startDate,
        endDate: body.endDate,
        isActive: false,
        version: 1,
      });
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id }, meta: { requestId: "test" } }),
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

test("Admin lists, creates, and sets active a financial year (FR-MAS-002/003)", async ({
  page,
}) => {
  const years = seedYears();
  await stubFinancialYears(page, years);
  await login(page);

  await page.goto("/master-data/financial-years");

  // List renders with the seeded active year.
  const table = page.getByTestId("fy-desktop");
  await expect(table.getByText("2025-26")).toBeVisible();
  await expect(table.locator('[aria-label="Active financial year"]')).toHaveCount(1);

  // Create a new financial year via the slide-over.
  await page.getByTestId("new-fy").click();
  const form = page.getByTestId("fy-form");
  await expect(form).toBeVisible();
  await form.getByLabel(/label/i).fill("2026-27");
  await form.getByLabel(/start date/i).fill("01/07/2026");
  await form.getByLabel(/end date/i).fill("30/06/2027");
  await page.getByTestId("fy-save").click();

  await expect(page.getByText("Financial year created.")).toBeVisible();
  await expect(table.getByText("2026-27")).toBeVisible();

  // Set the new year active via the ⋯ menu → confirm dialog.
  await table.getByTestId("fy-actions-fy101").click();
  await page.getByRole("menuitem", { name: "Set active" }).click();
  const dialog = page.getByTestId("set-active-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("set-active-confirm").click();

  await expect(page.getByText("is now the active financial year.")).toBeVisible();
  // The active badge moved to the newly-activated row (still exactly one active).
  await expect(table.locator('[aria-label="Active financial year"]')).toHaveCount(1);
});

test("date-order validation blocks save (end must be after start)", async ({ page }) => {
  const years = seedYears();
  await stubFinancialYears(page, years);
  await login(page);
  await page.goto("/master-data/financial-years");

  await page.getByTestId("new-fy").click();
  const form = page.getByTestId("fy-form");
  await form.getByLabel(/label/i).fill("2027-28");
  await form.getByLabel(/start date/i).fill("01/07/2027");
  await form.getByLabel(/end date/i).fill("30/06/2027");
  await page.getByTestId("fy-save").click();

  await expect(page.getByText("End date must be after the start date.")).toBeVisible();
  // Still open (not saved).
  await expect(form).toBeVisible();
});
