import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-11 account-ledger happy path (FR-LED-031/006/007): log in → land on the guarded
 * Account-ledger route pre-scoped with an account + date range (as a Trial-balance
 * drill would) → see the opening-balance row + a cumulative running balance →
 * read-only (no create/export). The state matrix + drill-down mode are covered in the
 * component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Line {
  lineId: string;
  lineNo: number;
  entryId: string;
  entryNo: string;
  voucherType: string;
  voucherDate: string;
  sourceType: string | null;
  sourceId: string | null;
  isReversal: boolean;
  accountId: string;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  godownId: string | null;
  partyId: string | null;
  debit: string;
  credit: string;
  runningBalance: string | null;
  narration: string | null;
}

const LINES: Line[] = [
  {
    lineId: "l1",
    lineNo: 1,
    entryId: "e1",
    entryNo: "RV/2025-26/0031",
    voucherType: "RECEIPT",
    voucherDate: "2026-06-29",
    sourceType: "ReceiptVoucher",
    sourceId: "rv-31",
    isReversal: false,
    accountId: "1201",
    projectId: "prj-tower-a",
    costCentreId: null,
    purposeId: null,
    godownId: null,
    partyId: "party-abc",
    debit: "0.0000",
    credit: "500000.0000",
    runningBalance: "1340000.0000",
    narration: "Client receipt — Tower-A milestone 3",
  },
];

async function stubLines(page: Page) {
  await page.route("**/api/ledger/lines**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        openingBalance: "1840000.0000",
        data: LINES,
        meta: { page: 1, pageSize: 25, total: LINES.length },
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

test("account ledger shows opening + running balance (read-only)", async ({ page }) => {
  await stubLines(page);
  await login(page);
  // Pre-scoped drill: account + date range → account-ledger mode.
  await page.goto("/ledger/account-ledger?accountId=1201&dateFrom=2025-04-01&dateTo=2026-06-30");

  await expect(page.getByTestId("ledger-title")).toHaveText("Account ledger");

  const opening = page.getByTestId("opening-balance-row");
  await expect(opening.getByText("Opening balance")).toBeVisible();
  await expect(opening.getByText("৳ 1,840,000.0000")).toBeVisible();

  const desktop = page.getByTestId("ledger-desktop");
  await expect(desktop.getByText("৳ 1,340,000.0000")).toBeVisible();

  // Read-only: no create / export.
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /new|create/i })).toHaveCount(0);
});
