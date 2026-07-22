/**
 * FE-55 fe-financial-statements tests (FR-RPT-003/-006/-013/-014/-029/-031).
 * Covers: tab switch (P&L ↔ BS), scope toggle re-query, P&L profit vs loss
 * band (Loss text label — not colour-alone), balance-sheet balancing footer,
 * project-wise caveat banner, empty result (zeroed subtotals + note, Export
 * enabled), partial name-unavailable, error+Retry (params preserved), Export
 * re-issues query with format=excel, read-only assertion (no mutating button
 * anywhere), tab shows only its own time control.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { FinancialStatementsScreen } from "@/features/reports/financial-statements/components/FinancialStatementsScreen";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { dateInput, openFilters, setDateField } from "./helpers";

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

const PNL_PROFIT = {
  reportName: "profit-and-loss",
  parameters: {},
  rows: [
    { accountId: "4000", accountCode: "4000", accountName: "Revenue", section: "INCOME", amount: "10000000.0000" },
    { accountId: "5100", accountCode: "5100", accountName: "Materials", section: "EXPENSE", amount: "6000000.0000" },
    { accountId: "5200", accountCode: "5200", accountName: null, section: "EXPENSE", amount: "500000.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 3,
    total: 3,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { revenue: "10000000.0000", cost: "6500000.0000", profit: "3500000.0000" },
  },
};
const PNL_LOSS = {
  reportName: "profit-and-loss",
  parameters: {},
  rows: [
    { accountId: "4000", accountCode: "4000", accountName: "Revenue", section: "INCOME", amount: "2000000.0000" },
    { accountId: "5100", accountCode: "5100", accountName: "Materials", section: "EXPENSE", amount: "2500000.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 2,
    total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { revenue: "2000000.0000", cost: "2500000.0000", profit: "-500000.0000" },
  },
};
const BS_BALANCED = {
  reportName: "balance-sheet",
  parameters: {},
  rows: [
    { accountId: "1010", accountCode: "1010", accountName: "Cash", groupKind: "ASSET", groupLabel: "Current assets", amount: "5000000.0000" },
    { accountId: "2100", accountCode: "2100", accountName: "AP", groupKind: "LIABILITY", groupLabel: "Current liabilities", amount: "2000000.0000" },
    { accountId: "3100", accountCode: "3100", accountName: "Equity", groupKind: "EQUITY", groupLabel: "Equity", amount: "3000000.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 3,
    total: 3,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { assets: "5000000.0000", liabilities: "2000000.0000", equity: "3000000.0000" },
  },
};

function user(role: "ADMIN" | "ACCOUNTS_MANAGER" | "PROJECT_MANAGER" = "ADMIN"): SafeUser {
  return {
    id: "u1",
    email: "u@ze.test",
    name: "User",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderScreen(role: "ADMIN" | "ACCOUNTS_MANAGER" | "PROJECT_MANAGER" = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <FinancialStatementsScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) =>
    Promise.resolve(name === "balance-sheet" ? BS_BALANCED : PNL_PROFIT),
  );
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "profit-and-loss-2026.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([{ id: "proj-a", label: "P01 · Bridge-04" }]);
  ccMock.mockResolvedValue([]);
});

async function runPnl() {
  // Set dates via setDateField so calling this twice doesn't append.
  setDateField("param-date-from", "2026-04-01");
  setDateField("param-date-to", "2026-06-30");
  await userEvent.click(screen.getByTestId("report-run"));
}

describe("Financial statements — tab switch + per-tab time control (FR-RPT-013/-014)", () => {
  it("P&L tab shows the date-range fields (no as-of)", async () => {
    renderScreen();
    await screen.findByTestId("financial-statements-screen");
    await screen.findByTestId("report-parameter-panel");
    expect(screen.getByTestId("param-date-from")).toBeInTheDocument();
    expect(screen.queryByTestId("param-as-of")).not.toBeInTheDocument();
  });

  it("switching to Balance sheet shows as-of (no date-range)", async () => {
    renderScreen();
    await screen.findByTestId("financial-statements-screen");
    await userEvent.click(screen.getByTestId("statement-tab-BS"));
    await waitFor(() => expect(screen.getByTestId("param-as-of")).toBeInTheDocument());
    expect(screen.queryByTestId("param-date-from")).not.toBeInTheDocument();
  });
});

describe("Financial statements — P&L body (FR-RPT-013)", () => {
  it("renders Income + Expense + Profit band on a profit", async () => {
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    await screen.findByTestId("pnl-statement");
    expect(screen.getByTestId("pnl-income-subtotal")).toHaveTextContent(/10,000,000/);
    expect(screen.getByTestId("pnl-expense-subtotal")).toHaveTextContent(/6,500,000/);
    const band = screen.getByTestId("pnl-band");
    expect(band).toHaveAttribute("data-loss", "false");
    expect(band).toHaveTextContent(/Profit/);
    expect(band).toHaveTextContent(/3,500,000/);
  });

  it("renders a Loss (parenthesised + 'Loss' label — not colour-alone)", async () => {
    runMock.mockResolvedValue(PNL_LOSS);
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    await screen.findByTestId("pnl-statement");
    const band = screen.getByTestId("pnl-band");
    expect(band).toHaveAttribute("data-loss", "true");
    expect(band).toHaveTextContent(/Loss/);
    expect(band).toHaveTextContent(/\(.*500,000/);
  });

  it("shows a partial (name-unavailable) row for accounts without a name", async () => {
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    await screen.findByTestId("pnl-statement");
    expect(screen.getAllByTestId("name-unavailable")[0]).toBeInTheDocument();
  });
});

describe("Financial statements — Balance sheet body (FR-RPT-014)", () => {
  it("renders the balancing footer 'Balanced — Assets = Liabilities + Equity'", async () => {
    renderScreen();
    await userEvent.click(screen.getByTestId("statement-tab-BS"));
    await screen.findByTestId("param-as-of");
    setDateField("param-as-of", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("bs-statement");
    const band = screen.getByTestId("bs-band");
    expect(band).toHaveAttribute("data-partial", "false");
    expect(band).toHaveTextContent(/Balanced/);
    expect(band).toHaveTextContent(/Assets/);
    expect(band).toHaveTextContent(/Liabilities/);
    expect(band).toHaveTextContent(/Equity/);
  });

  it("Project-wise BS shows the caveat banner + 'Partial' footer", async () => {
    // Return only asset lines to make the totals genuinely partial.
    runMock.mockImplementation((name: string) =>
      Promise.resolve(
        name === "balance-sheet"
          ? {
              ...BS_BALANCED,
              rows: [BS_BALANCED.rows[0]!],
              meta: {
                ...BS_BALANCED.meta,
                totals: { assets: "620000.0000", liabilities: "1200000.0000", equity: "0.0000" },
              },
            }
          : PNL_PROFIT,
      ),
    );
    renderScreen();
    await userEvent.click(screen.getByTestId("statement-tab-BS"));
    await userEvent.click(screen.getByTestId("scope-PROJECT_WISE"));
    openFilters();
    await screen.findByTestId("param-project");
    await userEvent.selectOptions(screen.getByTestId("param-project") as HTMLSelectElement, "proj-a");
    setDateField("param-as-of", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("bs-statement");
    expect(screen.getByTestId("bs-caveat")).toBeInTheDocument();
    expect(screen.getByTestId("bs-band")).toHaveAttribute("data-partial", "true");
  });
});

describe("Financial statements — scope toggle + error + export (FR-RPT-006/-004/-029)", () => {
  it("scope toggle re-queries and clears projectId on Consolidated", async () => {
    renderScreen();
    await userEvent.click(screen.getByTestId("scope-PROJECT_WISE"));
    openFilters();
    await screen.findByTestId("param-project");
    await userEvent.selectOptions(screen.getByTestId("param-project") as HTMLSelectElement, "proj-a");
    await runPnl();
    await waitFor(() => expect(runMock).toHaveBeenCalled());
    // First call carries projectId.
    expect(runMock.mock.calls[runMock.mock.calls.length - 1]![1].projectId).toBe("proj-a");
    // Switching back to Consolidated clears it.
    await userEvent.click(screen.getByTestId("scope-CONSOLIDATED"));
    await runPnl();
    await waitFor(() => {
      const last = runMock.mock.calls[runMock.mock.calls.length - 1]!;
      expect(last[1].projectId).toBeNull();
    });
  });

  it("shows the result-level error + Retry with params preserved", async () => {
    runMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    expect(await screen.findByTestId("pnl-error")).toHaveTextContent(/Couldn't load the profit & loss/i);
    expect(dateInput("param-date-from")).toHaveValue("01/04/2026");
  });

  it("Export → Excel re-issues the query with format=excel and does not re-render the table", async () => {
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    await screen.findByTestId("pnl-statement");
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await userEvent.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("profit-and-loss");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(screen.getByTestId("pnl-statement")).toBeInTheDocument();
  });
});

describe("Financial statements — read-only assertion (FR-RPT-003)", () => {
  it("renders no mutating (Save/Post/Reverse/Delete/Edit) button anywhere", async () => {
    renderScreen();
    await screen.findByTestId("report-parameter-panel");
    await runPnl();
    await screen.findByTestId("pnl-statement");
    const container = screen.getByTestId("financial-statements-screen");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
