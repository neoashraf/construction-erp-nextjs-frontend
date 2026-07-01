/**
 * FE-13 trial-balance tests (FR-LED-031/001/014/007).
 * Aggregated balances render, balance-proof chip/footer prove `totals.debit ===
 * totals.credit`, as-of-period disables the date range, Apply-only fetch +
 * `dateFrom > dateTo` validation, READ-ONLY assertion, drill-through, state matrix,
 * 403 permission-denied.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type TrialBalanceRow } from "@/features/ledger/types";
import { TrialBalanceScreen } from "@/features/ledger/components/TrialBalanceScreen";
import * as api from "@/features/ledger/api/trial-balance";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: pushMock }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("@/features/ledger/api/trial-balance", () => ({
  getTrialBalance: jest.fn(),
}));

const getMock = api.getTrialBalance as jest.Mock;

const ROW_1: TrialBalanceRow = {
  accountId: "1201",
  projectId: null,
  costCentreId: null,
  purposeId: null,
  godownId: null,
  partyId: null,
  debit: "1375000.0000",
  credit: "0.0000",
  net: "1375000.0000",
};
const ROW_2: TrialBalanceRow = {
  accountId: "2101",
  projectId: null,
  costCentreId: null,
  purposeId: null,
  godownId: null,
  partyId: null,
  debit: "0.0000",
  credit: "1375000.0000",
  net: "-1375000.0000",
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

function tbPage(
  rows: TrialBalanceRow[],
  totals: { debit: string; credit: string },
  total = rows.length,
) {
  return { data: rows, totals, page: 1, pageSize: 25, total };
}

function renderScreen(role: Role = "ACCOUNTS_TEAM") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <TrialBalanceScreen />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getMock.mockReset();
  pushMock.mockReset();
});

describe("TrialBalanceScreen — aggregated balances (FR-LED-031/001)", () => {
  it("renders account, debit, credit, net from the API response", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1, ROW_2], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();

    const row1 = await screen.findByTestId("tb-row-1201");
    expect(within(row1).getByText("1201")).toBeInTheDocument();
    expect(within(row1).getByLabelText("Debit ৳ 1,375,000.0000")).toBeInTheDocument();

    const row2 = screen.getByTestId("tb-row-2101");
    expect(within(row2).getByLabelText("Credit ৳ 1,375,000.0000")).toBeInTheDocument();
  });
});

describe("TrialBalanceScreen — balance proof (FR-LED-014/007)", () => {
  it("shows 'Balanced' in the chip and sticky totals footer when totals.debit === totals.credit", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1, ROW_2], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();

    await screen.findByTestId("tb-row-1201");

    const chip = screen.getByTestId("balance-proof-chip");
    expect(chip).toHaveAttribute("data-balanced", "true");
    expect(chip).toHaveTextContent("Balanced");
    expect(chip).toHaveTextContent("৳ 1,375,000.0000");

    const totalsRow = screen.getByTestId("tb-totals-row");
    expect(within(totalsRow).getByText("Balanced")).toBeInTheDocument();
    expect(within(totalsRow).getByLabelText("Total debit ৳ 1,375,000.0000")).toBeInTheDocument();
    expect(within(totalsRow).getByLabelText("Total credit ৳ 1,375,000.0000")).toBeInTheDocument();
  });

  it("flags 'Out of balance' when totals differ (defensive — the ledger always balances server-side)", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1000000.0000" }));
    renderScreen();

    await screen.findByTestId("tb-row-1201");
    const chip = screen.getByTestId("balance-proof-chip");
    expect(chip).toHaveAttribute("data-balanced", "false");
    expect(chip).toHaveTextContent("Out of balance");
  });
});

describe("TrialBalanceScreen — as-of period precedence (spec §9)", () => {
  it("disables the date range once a period is selected, and shows the precedence helper", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");

    const periodInput = screen.getByTestId("tb-filter-period");
    expect(screen.queryByTestId("tb-period-helper")).not.toBeInTheDocument();
    expect(screen.getByTestId("tb-filter-date-from")).not.toBeDisabled();

    await userEvent.type(periodInput, "per-q4-2025-26");

    expect(await screen.findByTestId("tb-period-helper")).toHaveTextContent(
      "Ignored when a period is selected",
    );
    expect(screen.getByTestId("tb-filter-date-from")).toBeDisabled();
    expect(screen.getByTestId("tb-filter-date-to")).toBeDisabled();

    // clearing the period re-enables the range
    await userEvent.clear(periodInput);
    await waitFor(() => expect(screen.getByTestId("tb-filter-date-from")).not.toBeDisabled());
    expect(screen.queryByTestId("tb-period-helper")).not.toBeInTheDocument();
  });
});

describe("TrialBalanceScreen — Apply-only fetch + validation (spec §7/§9)", () => {
  it("does not auto-fetch on filter changes; only fires on Apply", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");
    const before = getMock.mock.calls.length;

    await userEvent.type(screen.getByTestId("tb-filter-period"), "per-x");
    expect(getMock.mock.calls.length).toBe(before);

    await userEvent.click(screen.getByTestId("tb-apply"));
    await waitFor(() => expect(getMock.mock.calls.length).toBe(before + 1));
  });

  it("shows the inline date-order error and blocks Apply from firing", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");
    const before = getMock.mock.calls.length;

    const from = screen.getByTestId("tb-filter-date-from");
    const to = screen.getByTestId("tb-filter-date-to");
    await userEvent.type(from, "2026-06-30");
    await userEvent.type(to, "2025-04-01");
    await userEvent.click(screen.getByTestId("tb-apply"));

    expect(await screen.findByTestId("tb-date-error")).toHaveTextContent(
      "Date from cannot be after date to.",
    );
    expect(getMock.mock.calls.length).toBe(before);
  });

  it("Clear filters resets to the active-FY default", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");

    await userEvent.type(screen.getByTestId("tb-filter-period"), "per-x");
    await userEvent.click(screen.getByTestId("tb-clear"));

    expect(screen.getByTestId("tb-filter-period")).toHaveValue("");
  });

  it("include-reversals toggle defaults on", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");
    expect(getMock).toHaveBeenCalledWith(expect.objectContaining({ includeReversals: true }));
  });
});

describe("TrialBalanceScreen — drill-through (spec §9)", () => {
  it("clicking an account row navigates to Account ledger carrying the date scope", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    const row = await screen.findByTestId("tb-row-1201");
    await userEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/ledger/account-ledger?"));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("accountId=1201"));
  });
});

describe("TrialBalanceScreen — read-only (spec §9; SRS §10)", () => {
  it("has NO create / edit / delete / export / post affordance", async () => {
    getMock.mockResolvedValue(tbPage([ROW_1], { debit: "1375000.0000", credit: "1375000.0000" }));
    renderScreen();
    await screen.findByTestId("tb-row-1201");
    expect(screen.queryByRole("button", { name: /new|create|add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|void|post/i })).not.toBeInTheDocument();
    expect(screen.getByText("Read-only ledger query")).toBeInTheDocument();
  });
});

describe("TrialBalanceScreen — state matrix (spec §6)", () => {
  it("loading skeletons", async () => {
    getMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(await screen.findByTestId("tb-loading")).toBeInTheDocument();
  });

  it("empty + Clear filters shows zero totals", async () => {
    getMock.mockResolvedValue(tbPage([], { debit: "0.0000", credit: "0.0000" }, 0));
    renderScreen();
    expect(await screen.findByText("No balances for the selected filters.")).toBeInTheDocument();
    expect(screen.getByTestId("tb-empty-clear")).toBeInTheDocument();
    expect(screen.getAllByText("৳ 0.0000").length).toBeGreaterThan(0);
  });

  it("error + Retry", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(
      await screen.findByText("Couldn't load the trial balance. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tb-retry")).toBeInTheDocument();
  });
});

describe("TrialBalanceScreen — role / permission (spec §11)", () => {
  it("a plain 403 renders the permission-denied view", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByTestId("trial-balance-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to the ledger.")).toBeInTheDocument();
  });
});
