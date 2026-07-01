import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-10 journal-entries list happy path (FR-LED-031/005/030/026): log in → land on
 * the guarded Ledger route → see posted entry headers with totals + status badges →
 * apply a voucher-type filter (read-only; the request carries the filter). The full
 * state matrix + read-only assertion are covered in the component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

interface Entry {
  id: string;
  entryNo: string;
  financialYearId: string;
  voucherType: string;
  voucherDate: string;
  sourceType: string | null;
  sourceId: string | null;
  isReversal: boolean;
  reversalOf: string | null;
  isReversed: boolean;
  reversedByEntryId: string | null;
  narration: string | null;
  totalDebit: string;
  totalCredit: string;
  postedAt: string;
  postedBy: string | null;
}

const ALL: Entry[] = [
  {
    id: "e1",
    entryNo: "JE/2025-26/01184",
    financialYearId: "fy1",
    voucherType: "PAYMENT",
    voucherDate: "2026-06-30",
    sourceType: "PaymentVoucher",
    sourceId: "pv-42",
    isReversal: false,
    reversalOf: null,
    isReversed: false,
    reversedByEntryId: null,
    narration: "Payment to Shah Cement Ltd. against Bridge-04",
    totalDebit: "1240000.0000",
    totalCredit: "1240000.0000",
    postedAt: "2026-06-30T10:22:11Z",
    postedBy: "u-acc",
  },
  {
    id: "e2",
    entryNo: "JE/2025-26/01181",
    financialYearId: "fy1",
    voucherType: "JOURNAL",
    voucherDate: "2026-06-27",
    sourceType: "Journal",
    sourceId: "jv-19",
    isReversal: true,
    reversalOf: "e0",
    isReversed: false,
    reversedByEntryId: null,
    narration: "Reversal — rod purchase, Tower-A",
    totalDebit: "2070000.0000",
    totalCredit: "2070000.0000",
    postedAt: "2026-06-27T09:00:00Z",
    postedBy: "u-acc",
  },
];

async function stubEntries(page: Page) {
  await page.route("**/api/ledger/entries**", async (route: Route) => {
    const url = new URL(route.request().url());
    const vt = url.searchParams.get("voucherType");
    const data = vt ? ALL.filter((e) => e.voucherType === vt) : ALL;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: { page: 1, pageSize: 25, total: data.length } }),
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

test("lists posted journal entries and applies a voucher-type filter (read-only)", async ({
  page,
}) => {
  await stubEntries(page);
  await login(page);
  await page.goto("/ledger/journal-entries");

  // Headers + totals + a reversal badge render.
  const table = page.getByTestId("entries-desktop");
  await expect(table.getByText("JE/2025-26/01184")).toBeVisible();
  await expect(table.getByText("1,240,000.0000").first()).toBeVisible();
  await expect(table.getByTestId("entry-status-reversal")).toBeVisible();

  // Read-only: no create / export affordance anywhere.
  await expect(page.getByRole("button", { name: /new journal entry/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);

  // Apply a voucher-type filter → only the PAYMENT entry remains.
  await page.getByLabel(/voucher type/i).selectOption("PAYMENT");
  await page.getByTestId("entries-apply").click();
  await expect(table.getByText("JE/2025-26/01184")).toBeVisible();
  await expect(table.getByText("JE/2025-26/01181")).toHaveCount(0);
});
