/**
 * FE-11 account-ledger tests (FR-LED-031/006/012/030/007/026).
 * Mode switch (account-ledger vs drill-down), opening-balance + running-balance carry,
 * READ-ONLY assertion, reversal badge, party, source-voucher link, state matrix, 403.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type LedgerLine } from "@/features/ledger/types";
import { AccountLedgerScreen } from "@/features/ledger/components/AccountLedgerScreen";
import * as api from "@/features/ledger/api/lines";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("@/features/ledger/api/lines", () => ({
  listLedgerLines: jest.fn(),
}));

const listMock = api.listLedgerLines as jest.Mock;

const LINE1: LedgerLine = {
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
};
const LINE2: LedgerLine = {
  ...LINE1,
  lineId: "l2",
  entryId: "e2",
  entryNo: "JV/2025-26/0019",
  voucherType: "JOURNAL",
  voucherDate: "2026-06-27",
  sourceType: "Journal",
  sourceId: "jv-19",
  isReversal: true,
  debit: "70000.0000",
  credit: "0.0000",
  runningBalance: "1410000.0000",
  narration: "মেঘনা স্টিল — সমন্বয়",
};

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
  };
}
function ledgerPage(lines: LedgerLine[], openingBalance: string | null, total = lines.length) {
  return { data: lines, openingBalance, page: 1, pageSize: 25, total };
}
function renderScreen(
  role: Role = "ACCOUNTS_TEAM",
  initialFilter?: Record<string, string>,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <AccountLedgerScreen initialFilter={initialFilter} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

// Account-ledger mode preset: account + date range from an inbound drill.
const LEDGER_SCOPE = { accountId: "1201", dateFrom: "2025-04-01", dateTo: "2026-06-30" };

beforeEach(() => listMock.mockReset());

describe("AccountLedgerScreen — no-account prompt (spec §6)", () => {
  it("opens on the 'Select an account' prompt when no scope is supplied", async () => {
    // With no inbound scope the screen starts empty — the user picks an account
    // from the filter dropdown (spec §6 no-account state). It does NOT auto-load.
    listMock.mockResolvedValue(ledgerPage([LINE1], "1840000.0000"));
    renderScreen();
    expect(screen.getByText("Select an account to view its ledger.")).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("stays on the prompt after Clear filters", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    await screen.findByTestId("ledger-scope");
    await userEvent.click(screen.getByTestId("ledger-clear"));
    expect(screen.getByText("Select an account to view its ledger.")).toBeInTheDocument();
  });
});

describe("AccountLedgerScreen — inbound scope (Trial-balance drill)", () => {
  it("opens in account-ledger mode with the scope header when given account + dates", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    expect(await screen.findByTestId("ledger-title")).toHaveTextContent("Account ledger");
    expect(screen.getByTestId("ledger-scope")).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalled());
  });
});

describe("AccountLedgerScreen — account-ledger mode (FR-LED-007)", () => {
  it("renders the opening-balance row + cumulative running balance, titled 'Account ledger'", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1, LINE2], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);

    expect(await screen.findByTestId("ledger-title")).toHaveTextContent("Account ledger");

    // Opening balance row seeds the running balance (Decimal(18,4), ৳).
    const opening = await screen.findByTestId("opening-balance-row");
    expect(within(opening).getByText("Opening balance")).toBeInTheDocument();
    expect(within(opening).getByText("৳ 1,840,000.0000")).toBeInTheDocument();

    // Running-balance column present + cumulative across rows.
    const desktop = screen.getByTestId("ledger-desktop");
    expect(within(desktop).getByText("Running balance ৳")).toBeInTheDocument();
    expect(within(desktop).getByText("৳ 1,340,000.0000")).toBeInTheDocument();
    expect(within(desktop).getByText("৳ 1,410,000.0000")).toBeInTheDocument();
  });

  it("renders line fields: party, debit/credit, narration, reversal badge (FR-LED-006/012/026)", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1, LINE2], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    const row2 = await screen.findByTestId("ledger-row-l2");
    expect(within(row2).getByTestId("reversal-badge-l2")).toHaveTextContent("Reversal");
    expect(within(row2).getByText("party-abc")).toBeInTheDocument();
    // credit line (LINE1) shows the credit amount, no-symbol in the cell
    const row1 = screen.getByTestId("ledger-row-l1");
    expect(within(row1).getByLabelText("Credit ৳ 500,000.0000")).toBeInTheDocument();
  });
});

describe("AccountLedgerScreen — drill-down mode (spec §13)", () => {
  it("omits opening + running balance and titles 'Ledger drill-down'", async () => {
    // Drill-down: a dimension filter, no account → server omits opening/running.
    const drillLine = { ...LINE1, runningBalance: null };
    listMock.mockResolvedValue(ledgerPage([drillLine], null));
    renderScreen("ACCOUNTS_TEAM", { projectId: "prj-tower-a" });

    expect(await screen.findByTestId("ledger-title")).toHaveTextContent("Ledger drill-down");
    await screen.findByTestId("ledger-row-l1");
    expect(screen.queryByTestId("opening-balance-row")).not.toBeInTheDocument();
    expect(screen.queryByText("Running balance ৳")).not.toBeInTheDocument();
  });
});

describe("AccountLedgerScreen — read-only (spec §9; FR-LED-031)", () => {
  it("has NO create / edit / delete / export affordance", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    await screen.findByTestId("ledger-row-l1");
    expect(screen.queryByRole("button", { name: /new|create|add line/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|void/i })).not.toBeInTheDocument();
  });
});

describe("AccountLedgerScreen — state matrix", () => {
  it("loading skeletons", async () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    expect(await screen.findByTestId("ledger-loading")).toBeInTheDocument();
  });
  it("empty + Clear filters", async () => {
    listMock.mockResolvedValue(ledgerPage([], "0.0000", 0));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    expect(await screen.findByText("No ledger lines for the selected filters.")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-empty-clear")).toBeInTheDocument();
  });
  it("error + Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    expect(
      await screen.findByText("Couldn't load the account ledger. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ledger-retry")).toBeInTheDocument();
  });
  it("date validation blocks Apply before firing", async () => {
    listMock.mockResolvedValue(ledgerPage([LINE1], "1840000.0000"));
    renderScreen("ACCOUNTS_TEAM", LEDGER_SCOPE);
    await screen.findByTestId("ledger-row-l1");
    const before = listMock.mock.calls.length;
    const from = screen.getByLabelText(/date from/i);
    const to = screen.getByLabelText(/date to/i);
    await userEvent.clear(from);
    await userEvent.type(from, "2026-06-30");
    await userEvent.clear(to);
    await userEvent.type(to, "2025-04-01");
    await userEvent.click(screen.getByTestId("ledger-apply"));
    expect(await screen.findByTestId("ledger-date-error")).toHaveTextContent(
      "Date from cannot be after date to.",
    );
    expect(listMock.mock.calls.length).toBe(before);
  });
});

describe("AccountLedgerScreen — role / permission (spec §11)", () => {
  it("a 403 renders the permission-denied view", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen("PROJECT_MANAGER", LEDGER_SCOPE);
    expect(await screen.findByTestId("ledger-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to the ledger.")).toBeInTheDocument();
  });
});
