import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-13 trial-balance happy path (FR-LED-031/014/007): log in → land on the guarded
 * Trial-balance route → default load foots (Balanced chip + sticky totals) → click an
 * account row → navigate to Account ledger carrying the drilled `accountId`. The
 * state matrix, period-precedence disable, and read-only assertion are covered in the
 * component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Row {
  accountId: string;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  godownId: string | null;
  partyId: string | null;
  debit: string;
  credit: string;
  net: string;
}

const ROWS: Row[] = [
  {
    accountId: "1101",
    projectId: null,
    costCentreId: null,
    purposeId: null,
    godownId: null,
    partyId: null,
    debit: "840000.0000",
    credit: "0.0000",
    net: "840000.0000",
  },
  {
    accountId: "3101",
    projectId: null,
    costCentreId: null,
    purposeId: null,
    godownId: null,
    partyId: null,
    debit: "0.0000",
    credit: "840000.0000",
    net: "-840000.0000",
  },
];

async function stubTrialBalance(page: Page) {
  await page.route("**/api/ledger/trial-balance**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: ROWS,
        totals: { debit: "840000.0000", credit: "840000.0000" },
        meta: { page: 1, pageSize: 25, total: ROWS.length },
      }),
    });
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("trial balance foots and drills into an account (read-only)", async ({ page }) => {
  await stubTrialBalance(page);
  await login(page);
  await page.goto("/ledger/trial-balance");

  await expect(page.getByTestId("tb-title")).toHaveText("Trial balance");

  // Default load foots — the balance-proof chip proves totals.debit === totals.credit.
  const chip = page.getByTestId("balance-proof-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Balanced");
  await expect(chip).toContainText("৳ 840,000.0000");

  const totalsRow = page.getByTestId("tb-totals-row");
  await expect(totalsRow).toContainText("Balanced");

  // Read-only: no create / export / post.
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /new|create/i })).toHaveCount(0);

  // Drill-through: clicking an account row navigates to Account ledger.
  await page.getByTestId("tb-row-1101").click();
  await page.waitForURL("**/ledger/account-ledger?**");
  expect(page.url()).toContain("accountId=1101");
});
