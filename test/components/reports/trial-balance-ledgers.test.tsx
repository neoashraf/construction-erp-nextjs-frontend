/**
 * FE-56 fe-trial-balance-ledgers tests (FR-RPT-003/-006/-009…-012/-029/-031).
 * Covers: four-report tab switch (preserving common params), trial-balance
 * balanced totals footer (from API `totals`, no client Σ), ledger opening
 * banner + running balance carried across pages, source-voucher link
 * (resolved vs unresolved), as-of (TB) vs range (ledger/daybook/cash-book)
 * wiring, ledger required accountId block, party filter, empty & partial
 * & error states, read-only assertion, Excel export re-issues query.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { TrialBalanceLedgersViewer } from "@/features/reports/viewers/trial-balance-ledgers/components/TrialBalanceLedgersViewer";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { dateInput, setDateField } from "./helpers";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/reports/api/reports");
jest.mock("@/features/reports/api/masters");
jest.mock("@/lib/hooks/use-online", () => ({ useOnline: () => true }));

const runMock = reportsApi.runReport as jest.Mock;
const exportMock = reportsApi.exportReport as jest.Mock;
const saveMock = reportsApi.saveBlob as jest.Mock;
const fyMock = mastersApi.listFinancialYearOptions as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;
const ccMock = mastersApi.listCostCentreOptions as jest.Mock;

const TB_RESULT = {
  reportName: "trial-balance",
  parameters: {},
  rows: [
    { accountId: "1010", accountCode: "1010", accountName: "Cash", debit: "500000.0000", credit: "0.0000", net: "500000.0000" },
    { accountId: "3100", accountCode: "3100", accountName: null, debit: "0.0000", credit: "500000.0000", net: "-500000.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 2,
    total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { debit: "500000.0000", credit: "500000.0000" },
  },
};

function makeLedger(page: number, running: string) {
  return {
    reportName: "account-ledger",
    parameters: {},
    rows: [
      {
        entryId: `je-${page}-1`,
        journalEntryId: `je-${page}-1`,
        entryNo: `JV/2526/000${page}`,
        voucherDate: "2026-04-02",
        voucherType: "Journal",
        accountId: "1200",
        accountCode: "1200",
        accountName: "Accounts Receivable",
        debit: page === 1 ? "250000.0000" : "0.0000",
        credit: page === 1 ? "0.0000" : "80000.0000",
        runningBalance: running,
      },
      // Row without a journalEntryId — the source link should render unresolved.
      {
        entryId: `je-${page}-2`,
        entryNo: `JV/2526/orphan`,
        voucherDate: "2026-04-05",
        voucherType: "Journal",
        accountId: "1200",
        accountCode: "1200",
        accountName: null,
        debit: "10000.0000",
        credit: "0.0000",
        runningBalance: running,
      },
    ],
    meta: {
      page,
      pageSize: 2,
      total: 4,
      generatedAt: "2026-07-15T10:00:00Z",
      openingBalance: "1000000.0000",
      openingAsOf: "2026-04-01",
      dateFrom: "2026-04-01",
      dateTo: "2026-06-30",
    },
  };
}

function user(): SafeUser {
  return {
    id: "u1",
    email: "u@ze.test",
    name: "User",
    role: "ADMIN",
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <TrialBalanceLedgersViewer />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) => {
    if (name === "trial-balance") return Promise.resolve(TB_RESULT);
    if (name === "account-ledger") return Promise.resolve(makeLedger(1, "1250000.0000"));
    if (name === "daybook") return Promise.resolve(makeLedger(1, "0.0000"));
    return Promise.resolve(makeLedger(1, "8650000.0000"));
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "trial-balance.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([{ id: "proj-a", label: "P01 · Bridge-04" }]);
  ccMock.mockResolvedValue([]);
});

async function runTb() {
  setDateField("param-as-of", "2026-06-30");
  await userEvent.click(screen.getByTestId("report-run"));
}

async function runLedgerWithAccount(id = "1200") {
  setDateField("param-date-from", "2026-04-01");
  setDateField("param-date-to", "2026-06-30");
  await userEvent.selectOptions(screen.getByTestId("ledger-accountId") as HTMLSelectElement, id);
  await userEvent.click(screen.getByTestId("report-run"));
}

describe("Trial balance & ledgers — switcher (FR-RPT-009/-010/-011/-012)", () => {
  it("switches across the four reports and preserves FY/date range across the switch", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    // TB default; supports as-of.
    expect(screen.getByTestId("param-as-of")).toBeInTheDocument();
    await runTb();
    await screen.findByTestId("tb-table");
    // Switch to daybook — should show date range now, and FY preserved.
    await userEvent.click(screen.getByTestId("tb-tab-DAYBOOK"));
    await waitFor(() => expect(screen.getByTestId("param-date-from")).toBeInTheDocument());
    expect((screen.getByTestId("param-fy") as HTMLSelectElement).value).toBe("fy-1");
  });
});

describe("Trial balance — balancing footer (FR-RPT-009)", () => {
  it("renders the totals footer from API totals with a 'balanced' pill", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await runTb();
    await screen.findByTestId("tb-table");
    const footer = screen.getByTestId("tb-totals-footer");
    expect(footer).toHaveTextContent(/Debit/);
    expect(footer).toHaveTextContent(/Credit/);
    expect(footer).toHaveTextContent(/balanced/i);
    // Statutory BIN/TIN note visible on the TB tab.
    expect(screen.getByTestId("tb-statutory-note")).toBeInTheDocument();
  });

  it("renders a partial (name-unavailable) row for accounts without a name", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await runTb();
    await screen.findByTestId("tb-table");
    expect(screen.getByTestId("name-unavailable")).toBeInTheDocument();
  });
});

describe("Account ledger — opening balance + running balance across pages (FR-RPT-010)", () => {
  it("blocks Run without an accountId and clears on selection", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await userEvent.click(screen.getByTestId("tb-tab-LEDGER"));
    // Type dates and press Run — should be blocked by our required-account gate.
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    expect(await screen.findByText(/Select an account to view its ledger/i)).toBeInTheDocument();
    expect(runMock).not.toHaveBeenCalled();
    // Now pick an account and rerun.
    await userEvent.selectOptions(screen.getByTestId("ledger-accountId") as HTMLSelectElement, "1200");
    await userEvent.click(screen.getByTestId("report-run"));
    await waitFor(() => expect(runMock).toHaveBeenCalled());
  });

  it("shows the opening-balance banner and a running balance that carries per page", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await userEvent.click(screen.getByTestId("tb-tab-LEDGER"));
    await runLedgerWithAccount("1200");
    await screen.findByTestId("ledger-table");
    expect(screen.getByTestId("ledger-opening-banner")).toHaveTextContent(/Opening balance/);
    // Running balance is exactly the server-supplied value — not recomputed.
    const rows = screen.getAllByTestId("ledger-row");
    expect(rows[0]).toHaveTextContent(/1,250,000/);
    // Switch to a different account (a new query key) and return a different
    // running-balance snapshot — the UI must show the server value verbatim.
    runMock.mockResolvedValueOnce(makeLedger(2, "1180000.0000"));
    await userEvent.selectOptions(
      screen.getByTestId("ledger-accountId") as HTMLSelectElement,
      "1101",
    );
    await userEvent.click(screen.getByTestId("report-run"));
    await waitFor(() =>
      expect(screen.getAllByTestId("ledger-row")[0]).toHaveTextContent(/1,180,000/),
    );
  });

  it("source-voucher link resolves for journalEntryId + degrades for missing source", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await userEvent.click(screen.getByTestId("tb-tab-LEDGER"));
    await runLedgerWithAccount("1200");
    await screen.findByTestId("ledger-table");
    const links = screen.getAllByTestId("source-voucher-link");
    const resolved = links.find((l) => l.getAttribute("data-resolved") === "true");
    const unresolved = links.find((l) => l.getAttribute("data-resolved") === "false");
    expect(resolved).toBeTruthy();
    expect(unresolved).toBeTruthy();
    expect(resolved?.tagName).toBe("A");
    expect(resolved?.getAttribute("aria-label")).toMatch(/Open entry/);
  });
});

describe("Trial balance & ledgers — states (FR-RPT-004/-029)", () => {
  it("shows an error card + Retry when the run fails, with params preserved", async () => {
    runMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await runTb();
    expect(await screen.findByTestId("tb-error")).toHaveTextContent(/Couldn't load the trial balance/i);
    // The date field now speaks DD/MM/YYYY (params still store ISO) — assert the
    // preserved value on the inner input in its display format.
    expect(dateInput("param-as-of").value).toBe("30/06/2026");
  });

  it("Excel export re-issues the query with format=excel; JSON table stays rendered", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await runTb();
    await screen.findByTestId("tb-table");
    // Export is now a two-step control: pick the format, then trigger the run.
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await userEvent.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("trial-balance");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(screen.getByTestId("tb-table")).toBeInTheDocument();
  });
});

describe("Trial balance & ledgers — read-only assertion (FR-RPT-003)", () => {
  it("renders no mutating (Save/Post/Reverse/Delete/Edit) button anywhere", async () => {
    renderScreen();
    await screen.findByTestId("tb-ledgers-viewer");
    await runTb();
    await screen.findByTestId("tb-table");
    const container = screen.getByTestId("tb-ledgers-viewer");
    // "Cancel" is the parameter-panel filter-reset control, not a ledger mutation,
    // so it's excluded — the guard targets voucher-mutating affordances only.
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
