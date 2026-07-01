/**
 * FE-15 period-manager component tests (FR-PER-001/002/008/009/010; screen spec
 * 04-period-control/period-manager.md). Full state matrix, confirm-dialog gated
 * close/reopen/generate/close-all, PERIOD_FY_LOCKED reopen rejection (distinct
 * from FORBIDDEN), OPTIMISTIC_LOCK_CONFLICT/PERIOD_ALREADY_* refresh mapping, and
 * role gating (Admin vs Accounts Team vs read-only roles).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type AccountingPeriod, type FinancialYearOption } from "@/features/period/types";
import { PeriodManagerScreen } from "@/features/period/components/PeriodManagerScreen";
import * as periodsApi from "@/features/period/api/periods";
import * as fyApi from "@/features/period/api/financial-year-options";

jest.mock("@/features/period/api/periods", () => ({
  listPeriods: jest.fn(),
  generatePeriods: jest.fn(),
  closePeriod: jest.fn(),
  reopenPeriod: jest.fn(),
  closeFinancialYear: jest.fn(),
}));

jest.mock("@/features/period/api/financial-year-options", () => ({
  listFinancialYearOptions: jest.fn(),
}));

const listPeriodsMock = periodsApi.listPeriods as jest.Mock;
const generateMock = periodsApi.generatePeriods as jest.Mock;
const closeMock = periodsApi.closePeriod as jest.Mock;
const reopenMock = periodsApi.reopenPeriod as jest.Mock;
const closeFyMock = periodsApi.closeFinancialYear as jest.Mock;
const listFyMock = fyApi.listFinancialYearOptions as jest.Mock;

const FY: FinancialYearOption = {
  id: "fy1",
  label: "FY 2025–26",
  startDate: "2025-07-01",
  endDate: "2026-06-30",
  isActive: true,
};

function period(overrides: Partial<AccountingPeriod> = {}): AccountingPeriod {
  return {
    id: "p1",
    financialYearId: "fy1",
    name: "Jul 2025",
    startDate: "2025-07-01",
    endDate: "2025-07-31",
    status: "OPEN",
    closedAt: null,
    closedBy: null,
    createdAt: "2025-07-01T00:00:00Z",
    updatedAt: "2025-07-01T00:00:00Z",
    ...overrides,
  };
}

function twoOpenOneClosed(): AccountingPeriod[] {
  return [
    period({ id: "p1", name: "Jul 2025", startDate: "2025-07-01", endDate: "2025-07-31" }),
    period({
      id: "p2",
      name: "Aug 2025",
      startDate: "2025-08-01",
      endDate: "2025-08-31",
      status: "CLOSED",
      closedAt: "2025-09-03T10:14:00Z",
      closedBy: "Ashraf Uddin",
    }),
    period({ id: "p3", name: "Sep 2025", startDate: "2025-09-01", endDate: "2025-09-30" }),
  ];
}

function allClosed(): AccountingPeriod[] {
  return twoOpenOneClosed().map((p) => ({
    ...p,
    status: "CLOSED",
    closedAt: "2026-01-01T00:00:00Z",
    closedBy: "Ashraf Uddin",
  }));
}

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

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderScreen(role: Role = "ADMIN") {
  return render(
    <QueryClientProvider client={client()}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <PeriodManagerScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listPeriodsMock.mockReset();
  generateMock.mockReset();
  closeMock.mockReset();
  reopenMock.mockReset();
  closeFyMock.mockReset();
  listFyMock.mockReset();
  listFyMock.mockResolvedValue([FY]);
});

// ── State matrix (spec §6) ──
describe("PeriodManagerScreen — state matrix", () => {
  it("shows loading skeletons first", () => {
    listPeriodsMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("periods-loading")).toBeInTheDocument();
  });

  it("lists periods ordered by startDate asc with the exact columns (FR-PER-001)", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen();
    const table = await screen.findByTestId("period-table");
    expect(within(table).getByText("Period")).toBeInTheDocument();
    expect(within(table).getByText("Date range")).toBeInTheDocument();
    expect(within(table).getByText("Status")).toBeInTheDocument();
    expect(within(table).getByText("Closed at")).toBeInTheDocument();
    expect(within(table).getByText("Closed by")).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    // header + 3 data rows
    expect(rows).toHaveLength(4);
    const [, row1, row2] = rows;
    expect(row1 && within(row1).getByText("Jul 2025")).toBeInTheDocument();
    expect(row2 && within(row2).getByText("Aug 2025")).toBeInTheDocument();
    expect(row2 && within(row2).getByText("01/08/2025 – 31/08/2025")).toBeInTheDocument();
    expect(row2 && within(row2).getByText("Ashraf Uddin")).toBeInTheDocument();
  });

  it("empty state shows the Generate CTA for Admin (period.generate)", async () => {
    listPeriodsMock.mockResolvedValue([]);
    renderScreen("ADMIN");
    expect(
      await screen.findByText("No periods have been generated for this financial year."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("empty-generate-periods")).toBeInTheDocument();
  });

  it("empty state hides the Generate CTA for non-Admin", async () => {
    listPeriodsMock.mockResolvedValue([]);
    renderScreen("ACCOUNTS_TEAM");
    await screen.findByText("No periods have been generated for this financial year.");
    expect(screen.queryByTestId("empty-generate-periods")).not.toBeInTheDocument();
  });

  it("partial: a CLOSED row missing closedBy/closedAt renders em-dash and stays actionable", async () => {
    listPeriodsMock.mockResolvedValue([
      period({ id: "p2", status: "CLOSED", closedAt: null, closedBy: null }),
    ]);
    renderScreen("ADMIN");
    const table = await screen.findByTestId("period-table");
    const cells = within(table).getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("reopen-p2")).toBeInTheDocument();
  });

  it("error shows Retry; FINANCIAL_YEAR_NOT_FOUND maps to the exact copy", async () => {
    listPeriodsMock.mockRejectedValue(
      new ApiError({ code: "FINANCIAL_YEAR_NOT_FOUND", message: "x", details: null, status: 404 }),
    );
    renderScreen();
    expect(await screen.findByText("This financial year wasn't found.")).toBeInTheDocument();
    expect(screen.getByTestId("periods-retry")).toBeInTheDocument();
  });

  it("generic load error shows the standard banner", async () => {
    listPeriodsMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load periods.")).toBeInTheDocument();
  });
});

// ── Toolbar (spec §5) ──
describe("PeriodManagerScreen — FY-level toolbar", () => {
  it("shows Generate when the FY has no periods", async () => {
    listPeriodsMock.mockResolvedValue([]);
    renderScreen("ADMIN");
    expect(await screen.findByTestId("generate-periods")).toBeInTheDocument();
  });

  it("hides Generate once periods exist", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    expect(screen.queryByTestId("generate-periods")).not.toBeInTheDocument();
  });

  it("shows Close-all when ≥1 period is OPEN, for period.close roles", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ACCOUNTS_TEAM");
    expect(await screen.findByTestId("close-all")).toBeInTheDocument();
  });

  it("hides Close-all and shows the FY-locked banner when all periods are CLOSED", async () => {
    listPeriodsMock.mockResolvedValue(allClosed());
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    expect(screen.queryByTestId("close-all")).not.toBeInTheDocument();
    expect(
      screen.getByText("This financial year is locked — all periods are closed."),
    ).toBeInTheDocument();
  });
});

// ── Close / Reopen actions + confirm dialogs (spec §8/§9) ──
describe("PeriodManagerScreen — close action", () => {
  it("Close opens the confirm dialog with exact copy; no API call until Confirm", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-p1"));

    expect(await screen.findByTestId("close-dialog")).toBeInTheDocument();
    expect(screen.getByText("Close Jul 2025?")).toBeInTheDocument();
    expect(
      screen.getByText(/Closing this period locks it\. No vouchers can be posted/),
    ).toBeInTheDocument();
    expect(closeMock).not.toHaveBeenCalled();
  });

  it("Esc closes the dialog without calling the API", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-p1"));
    await screen.findByTestId("close-dialog");
    await u.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("close-dialog")).not.toBeInTheDocument());
    expect(closeMock).not.toHaveBeenCalled();
  });

  it("Confirm calls POST close and shows the success toast, dialog closes", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    closeMock.mockResolvedValue(period({ id: "p1", status: "CLOSED", closedAt: "2025-08-01T00:00:00Z", closedBy: "Ashraf Uddin" }));
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-p1"));
    await screen.findByTestId("close-dialog");
    await u.click(screen.getByTestId("close-dialog-confirm"));

    await waitFor(() => expect(closeMock).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("Period closed.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("close-dialog")).not.toBeInTheDocument());
  });

  it("Close is visible only on OPEN rows; Reopen only on CLOSED rows (mutually exclusive)", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    expect(screen.getByTestId("close-p1")).toBeInTheDocument();
    expect(screen.queryByTestId("reopen-p1")).not.toBeInTheDocument();
    expect(screen.getByTestId("reopen-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("close-p2")).not.toBeInTheDocument();
  });
});

describe("PeriodManagerScreen — reopen action + PERIOD_FY_LOCKED", () => {
  it("Reopen opens its confirm dialog with exact copy", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("reopen-p2"));
    expect(await screen.findByTestId("reopen-dialog")).toBeInTheDocument();
    expect(screen.getByText("Reopen Aug 2025?")).toBeInTheDocument();
    expect(screen.getByText(/Reopening unlocks this period/)).toBeInTheDocument();
  });

  it("PERIOD_FY_LOCKED keeps the dialog open with the exact year-locked message, distinct from FORBIDDEN", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    reopenMock.mockRejectedValue(
      new ApiError({ code: "PERIOD_FY_LOCKED", message: "locked", details: null, status: 409 }),
    );
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("reopen-p2"));
    await screen.findByTestId("reopen-dialog");
    await u.click(screen.getByTestId("reopen-dialog-confirm"));

    expect(
      await screen.findByText(
        "This period's financial year is locked. Unlock the financial year before reopening this period.",
      ),
    ).toBeInTheDocument();
    // Dialog stays open (not treated as a silent FORBIDDEN toast-and-close).
    expect(screen.getByTestId("reopen-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("reopen-dialog-confirm")).toBeDisabled();
  });

  it("a plain 403 FORBIDDEN closes the dialog and toasts the permission message", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    reopenMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "nope", details: null, status: 403 }),
    );
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("reopen-p2"));
    await screen.findByTestId("reopen-dialog");
    await u.click(screen.getByTestId("reopen-dialog-confirm"));

    expect(await screen.findByText("You don't have permission to do that.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("reopen-dialog")).not.toBeInTheDocument());
  });

  it("OPTIMISTIC_LOCK_CONFLICT / PERIOD_ALREADY_OPEN closes the dialog, refreshes, and shows the refresh message", async () => {
    listPeriodsMock.mockResolvedValueOnce(twoOpenOneClosed());
    reopenMock.mockRejectedValue(
      new ApiError({ code: "PERIOD_ALREADY_OPEN", message: "x", details: null, status: 409 }),
    );
    listPeriodsMock.mockResolvedValueOnce(twoOpenOneClosed());
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("reopen-p2"));
    await screen.findByTestId("reopen-dialog");
    await u.click(screen.getByTestId("reopen-dialog-confirm"));

    expect(
      await screen.findByText(
        "This period was just changed by someone else. The list has been refreshed.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("reopen-dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(listPeriodsMock).toHaveBeenCalledTimes(2));
  });
});

describe("PeriodManagerScreen — generate + close-all", () => {
  it("Generate confirm calls POST generate and shows the count toast", async () => {
    listPeriodsMock.mockResolvedValue([]);
    generateMock.mockResolvedValue({ financialYearId: "fy1", count: 12, periods: twoOpenOneClosed() });
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await u.click(await screen.findByTestId("generate-periods"));
    expect(await screen.findByTestId("generate-dialog")).toBeInTheDocument();
    expect(screen.getByText("Generate periods?")).toBeInTheDocument();
    await u.click(screen.getByTestId("generate-dialog-confirm"));

    await waitFor(() => expect(generateMock).toHaveBeenCalledWith("fy1"));
    expect(await screen.findByText("Generated 12 periods.")).toBeInTheDocument();
  });

  it("PERIODS_ALREADY_EXIST maps to the exact error toast", async () => {
    listPeriodsMock.mockResolvedValue([]);
    generateMock.mockRejectedValue(
      new ApiError({ code: "PERIODS_ALREADY_EXIST", message: "x", details: null, status: 409 }),
    );
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await u.click(await screen.findByTestId("generate-periods"));
    await screen.findByTestId("generate-dialog");
    await u.click(screen.getByTestId("generate-dialog-confirm"));
    expect(
      await screen.findByText("Periods already exist for this financial year."),
    ).toBeInTheDocument();
  });

  it("Close-all confirm calls POST close-fy and shows the FY-locked success copy", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    closeFyMock.mockResolvedValue({
      financialYearId: "fy1",
      closedCount: 2,
      alreadyClosedCount: 1,
      periods: allClosed(),
    });
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-all"));
    expect(await screen.findByTestId("close-fy-dialog")).toBeInTheDocument();
    expect(screen.getByText("Close all periods for FY 2025–26?")).toBeInTheDocument();
    await u.click(screen.getByTestId("close-fy-dialog-confirm"));

    await waitFor(() => expect(closeFyMock).toHaveBeenCalledWith("fy1"));
    expect(await screen.findByText("Closed 2 periods. Financial year locked.")).toBeInTheDocument();
  });

  it("NO_PERIODS_FOR_FY maps to the exact error toast on close-all", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    closeFyMock.mockRejectedValue(
      new ApiError({ code: "NO_PERIODS_FOR_FY", message: "x", details: null, status: 404 }),
    );
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-all"));
    await screen.findByTestId("close-fy-dialog");
    await u.click(screen.getByTestId("close-fy-dialog-confirm"));
    expect(
      await screen.findByText("No periods have been generated for this financial year yet."),
    ).toBeInTheDocument();
  });
});

// ── Role gating (spec §11) ──
describe("PeriodManagerScreen — role gating", () => {
  it("Admin sees Close, Reopen, Generate, and Close-all", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    expect(screen.getByTestId("close-p1")).toBeInTheDocument();
    expect(screen.getByTestId("reopen-p2")).toBeInTheDocument();
    expect(screen.getByTestId("close-all")).toBeInTheDocument();
  });

  it("Accounts Team sees Close + Close-all but no Reopen and no Generate", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ACCOUNTS_TEAM");
    await screen.findByTestId("period-table");
    expect(screen.getByTestId("close-p1")).toBeInTheDocument();
    expect(screen.queryByTestId("reopen-p2")).not.toBeInTheDocument();
    expect(screen.getByTestId("close-all")).toBeInTheDocument();
    expect(screen.queryByTestId("generate-periods")).not.toBeInTheDocument();
  });

  it("a role with neither period.close nor period.reopen sees a read-only list", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("SITE_ENGINEER");
    await screen.findByTestId("period-table");
    expect(screen.queryByTestId("close-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reopen-p2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("close-all")).not.toBeInTheDocument();
    expect(screen.queryByTestId("generate-periods")).not.toBeInTheDocument();
    expect(screen.getByTestId("read-only-note")).toBeInTheDocument();
    expect(screen.queryByText("Action")).not.toBeInTheDocument();
  });
});

// ── a11y (spec §10) ──
describe("PeriodManagerScreen — a11y", () => {
  it("confirm dialog is role=dialog aria-modal, and Cancel gets initial focus", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-p1"));
    const dialog = await screen.findByTestId("close-dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByTestId("close-dialog-cancel")).toHaveFocus());
  });

  it("in-flight row action sets aria-busy and stays labelled", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    let resolveClose: (v: AccountingPeriod) => void = () => {};
    closeMock.mockReturnValue(new Promise((res) => (resolveClose = res)));
    const u = userEvent.setup();
    renderScreen("ADMIN");
    await screen.findByTestId("period-table");
    await u.click(screen.getByTestId("close-p1"));
    await screen.findByTestId("close-dialog");
    await u.click(screen.getByTestId("close-dialog-confirm"));

    const confirmBtn = screen.getByTestId("close-dialog-confirm");
    expect(confirmBtn).toHaveAttribute("aria-busy", "true");
    expect(confirmBtn).toHaveTextContent("Closing…");
    resolveClose(period({ id: "p1", status: "CLOSED" }));
    await waitFor(() => expect(screen.queryByTestId("close-dialog")).not.toBeInTheDocument());
  });

  it("status badges convey state via text, not colour alone", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ADMIN");
    const table = await screen.findByTestId("period-table");
    expect(within(table).getAllByText("Open").length).toBeGreaterThan(0);
    expect(within(table).getByText("Closed")).toBeInTheDocument();
  });

  it("column headers use th scope=col", async () => {
    listPeriodsMock.mockResolvedValue(twoOpenOneClosed());
    renderScreen("ADMIN");
    const table = await screen.findByTestId("period-table");
    const header = within(table).getByText("Period").closest("th");
    expect(header).toHaveAttribute("scope", "col");
  });
});
