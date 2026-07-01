import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * FE-12 entry-viewer happy path (FR-LED-005/006/030/026/024/007): log in → deep-link
 * to the guarded Entry-viewer route by `?id=` → see the header, balanced lines, the
 * "Balanced" totals proof, the source-voucher link, and no mutation control anywhere.
 * The full state matrix + reversal linkage are covered in the component tests.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

const ENTRY = {
  id: "e1",
  entryNo: "JV/2025-26/0042",
  financialYearId: "fy1",
  voucherType: "JOURNAL",
  voucherDate: "2026-06-29",
  sourceType: "JournalVoucher",
  sourceId: "jv-42",
  isReversal: false,
  reversalOf: null,
  isReversed: false,
  reversedByEntryId: null,
  reversedBy: null,
  narration: "IPC #7 — Slab",
  postedAt: "2026-06-29T10:22:11Z",
  postedBy: "u-acc",
  totalDebit: "1075000.0000",
  totalCredit: "1075000.0000",
  lines: [
    {
      id: "l1",
      lineNo: 1,
      accountId: "1201",
      projectId: "prj-tower-a",
      costCentreId: "cc-1",
      purposeId: "pur-1",
      godownId: null,
      partyId: "party-abc",
      debit: "1075000.0000",
      credit: "0.0000",
      narration: "Client receipt",
    },
    {
      id: "l2",
      lineNo: 2,
      accountId: "4001",
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: null,
      debit: "0.0000",
      credit: "1075000.0000",
      narration: null,
    },
  ],
};

async function stubEntry(page: Page) {
  await page.route("**/api/ledger/entries/e1", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ENTRY),
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

test("opens an entry by deep-link and shows the balanced, read-only viewer", async ({ page }) => {
  await stubEntry(page);
  await login(page);
  await page.goto("/ledger/entry-viewer?id=e1");

  // Header renders entry_no, status, date.
  const header = page.getByTestId("entry-header");
  await expect(header.getByText("JV/2025-26/0042")).toBeVisible();
  await expect(header.getByTestId("entry-status-normal")).toBeVisible();
  await expect(header.getByText("29/06/2026", { exact: true })).toBeVisible();
  await expect(page.getByTestId("immutability-note")).toBeVisible();

  // Lines render with the four dimensions + party + Dr/Cr.
  const line1 = page.getByTestId("entry-line-1");
  await expect(line1.getByText("1201")).toBeVisible();
  await expect(line1.getByText("prj-tower-a")).toBeVisible();

  // Totals footer proves the entry balances.
  const footer = page.getByTestId("entry-totals-footer");
  await expect(footer.getByTestId("balance-badge")).toHaveText("Balanced");

  // Source-voucher link routes to the originating document.
  const panel = page.getByTestId("entry-linkage-panel");
  await expect(panel.getByText("Source: JournalVoucher")).toBeVisible();
  await expect(panel.getByRole("link", { name: /jv-42/ })).toHaveAttribute(
    "href",
    "/vouchers/journalvoucher/jv-42",
  );

  // Read-only: no create / edit / delete / void / export affordance anywhere.
  await expect(page.getByRole("button", { name: /^edit/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete|void/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
});
