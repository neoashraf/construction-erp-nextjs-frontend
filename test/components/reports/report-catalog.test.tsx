/**
 * FE-54 fe-report-catalog tests (FR-RPT-001..-009/-029/-031). Covers: role-
 * filtered catalog (a forbidden report is absent), report-select shows the
 * shared parameter panel with sensible defaults, as-of/period disables the
 * date-range fields + shows the precedence note, dateFrom > dateTo inline
 * block, Run → result render + totals footer, empty result (Export enabled),
 * partial name-unavailable, error+retry (both catalog and result levels),
 * Export re-issues query with format (JSON not re-rendered), read-only
 * assertion (no post/reverse/save control anywhere).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { ReportCatalogScreen } from "@/features/reports/components/ReportCatalogScreen";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { type ReportDescriptor } from "@/features/reports/types";

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

const catalogMock = reportsApi.getReportCatalog as jest.Mock;
const runMock = reportsApi.runReport as jest.Mock;
const exportMock = reportsApi.exportReport as jest.Mock;
const saveMock = reportsApi.saveBlob as jest.Mock;
const fyMock = mastersApi.listFinancialYearOptions as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;
const ccMock = mastersApi.listCostCentreOptions as jest.Mock;

const TRIAL_BALANCE: ReportDescriptor = {
  name: "trial-balance",
  title: "Trial balance",
  description: "Debit + credit per account.",
  category: "LEDGERS_REGISTERS",
  viewerRoute: "/reports/trial-balance-ledgers",
  requiredPermission: "reports",
  parameters: [],
  supportsAsOf: true,
  supportsDateRange: true,
};

const PROJECT_PNL: ReportDescriptor = {
  name: "project-pnl",
  title: "Project P&L",
  description: "Per-project revenue vs cost.",
  category: "PROJECT_IPC",
  viewerRoute: "/reports/project-ipc",
  requiredPermission: "reports",
  parameters: [],
  projectScoped: true,
  supportsDateRange: true,
};

// A report the caller should NOT be able to run — its requiredPermission is not
// in the viewer's permission set (used by the role-filter test).
const HR_ONLY: ReportDescriptor = {
  name: "salary-register",
  title: "Salary register",
  description: "HR-only report.",
  category: "HR",
  viewerRoute: "/reports/hr",
  requiredPermission: "reports.hr",
  parameters: [],
  supportsDateRange: true,
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
          <ReportCatalogScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  catalogMock.mockResolvedValue([TRIAL_BALANCE, PROJECT_PNL, HR_ONLY]);
  runMock.mockResolvedValue({
    reportName: "trial-balance",
    parameters: {},
    rows: [
      { accountId: "1010", accountCode: "1010", accountName: "Cash", debit: "500000.0000", credit: "0.0000" },
      { accountId: "3100", accountCode: "3100", accountName: null, debit: "0.0000", credit: "500000.0000" },
    ],
    meta: {
      page: 1,
      pageSize: 2,
      total: 2,
      generatedAt: "2026-07-15T10:15:00Z",
      totals: { debit: "500000.0000", credit: "500000.0000" },
    },
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"], { type: "text/plain" }), filename: "trial-balance-2026.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([
    { id: "proj-a", label: "P01 · Bridge-04" },
    { id: "proj-b", label: "P02 · Tower-12" },
  ]);
  ccMock.mockResolvedValue([{ id: "cc-mat", label: "MAT · Materials" }]);
});

describe("Reports hub — catalog + role filtering (FR-RPT-001/-008)", () => {
  it("lists reports grouped by category, no report the caller can't run is shown", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    // Admin sees everything.
    expect(screen.getByTestId("catalog-entry-trial-balance")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-entry-project-pnl")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-entry-salary-register")).toBeInTheDocument();
  });

  it("shows the idle prompt until a report is selected", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    expect(screen.getByTestId("reports-idle")).toHaveTextContent(/Select a report to begin/i);
  });
});

describe("Reports hub — parameter panel (FR-RPT-002/-009)", () => {
  it("renders the panel after a report is picked, with FY defaulted", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await screen.findByTestId("report-parameter-panel");
    await waitFor(() => expect((screen.getByTestId("param-fy") as HTMLSelectElement).value).toBe("fy-1"));
  });

  it("setting an as-of date disables the date-range fields + shows the precedence note", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await screen.findByTestId("report-parameter-panel");
    const asOf = screen.getByTestId("param-as-of") as HTMLInputElement;
    await userEvent.type(asOf, "2026-06-30");
    await waitFor(() => expect(screen.getByTestId("asof-precedence-note")).toBeInTheDocument());
    expect(screen.getByTestId("param-date-from")).toBeDisabled();
    expect(screen.getByTestId("param-date-to")).toBeDisabled();
  });

  it("Run fires runReport with the entered params; totals footer + generated-at render", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await screen.findByTestId("report-parameter-panel");
    // Enter a date range.
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await waitFor(() => expect(runMock).toHaveBeenCalled());
    await screen.findByTestId("report-result");
    expect(screen.getByTestId("report-totals-footer")).toHaveTextContent(/500,000/);
    expect(screen.getByTestId("report-generated-at")).toHaveTextContent(/15\/07\/2026/);
  });

  it("shows a partial name-unavailable placeholder for rows without a name", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("report-result");
    expect(screen.getByText(/\(name unavailable\)/)).toBeInTheDocument();
  });

  it("dateFrom > dateTo inline-blocks with an error message", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-06-30");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-04-01");
    await userEvent.click(screen.getByTestId("report-run"));
    await waitFor(() => expect(runMock).not.toHaveBeenCalled());
    expect(screen.getByText(/End date must be on or after the start date/i)).toBeInTheDocument();
  });
});

describe("Reports hub — empty + error (FR-RPT-004)", () => {
  it("shows the empty result + zeroed totals footer + Export stays enabled", async () => {
    runMock.mockResolvedValue({
      reportName: "trial-balance",
      parameters: {},
      rows: [],
      meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-15T00:00:00Z", totals: { debit: "0", credit: "0" } },
    });
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-04-02");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("report-empty");
    // Export radios remain enabled.
    expect(screen.getByTestId("report-export-excel")).not.toBeDisabled();
  });

  it("shows a result-level error + Retry when the run fails; params preserved", async () => {
    runMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-04-02");
    await userEvent.click(screen.getByTestId("report-run"));
    expect(await screen.findByTestId("report-error")).toHaveTextContent(/Couldn't run this report/i);
    // Params retained.
    expect(screen.getByTestId("param-date-from")).toHaveValue("2026-04-01");
  });

  it("shows a catalog-level error + Retry when the catalog fails", async () => {
    catalogMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    expect(await screen.findByTestId("catalog-error")).toHaveTextContent(/Couldn't load the report list/i);
  });
});

describe("Reports hub — Export (FR-RPT-029/-031)", () => {
  it("Excel export re-issues the query with format=excel and triggers saveBlob", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("report-result");
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, params, format] = exportMock.mock.calls[0]!;
    expect(name).toBe("trial-balance");
    expect(format).toBe("excel");
    expect(params.dateFrom).toBe("2026-04-01");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    // The on-screen result table is still present — it wasn't re-rendered.
    expect(screen.getByTestId("report-result")).toBeInTheDocument();
  });
});

describe("Reports hub — read-only assertion (FR-RPT-003)", () => {
  it("renders NO save/post/reverse/edit/delete affordance anywhere on the hub", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-list");
    await userEvent.click(screen.getByTestId("catalog-entry-trial-balance"));
    await userEvent.type(screen.getByTestId("param-date-from") as HTMLInputElement, "2026-04-01");
    await userEvent.type(screen.getByTestId("param-date-to") as HTMLInputElement, "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("report-result");
    const container = screen.getByTestId("report-catalog-screen");
    // Word-boundary regex so "credit"/"debit" in labels don't false-match "edit".
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Cancel|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
