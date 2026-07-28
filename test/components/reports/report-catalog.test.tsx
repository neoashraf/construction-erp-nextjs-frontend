/**
 * FE-54 fe-report-catalog tests (FR-RPT-001/-003/-008). The hub matches
 * `Reports.dc.html`: a browse strip (category tabs + report chips + a catalog
 * search) sits above the pane, and the default artboard is "catalog loaded · no
 * report selected · right pane shows the prompt" — so nothing auto-opens.
 * Picking a chip mounts that category's viewer INLINE (no navigation) and
 * extends the breadcrumb to `Reports / <report>`. The hub's own responsibility
 * is therefore: role-filter the catalog, render the browse strip, mount the
 * right viewer inline, keep the breadcrumb in sync, surface a catalog-level
 * error + retry, and stay read-only. Run / result / totals / empty / export
 * behaviour lives in each viewer's own suite.
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

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: pushMock }),
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
  projectRequired: true,
  supportsDateRange: true,
};

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
    rows: [],
    meta: { page: 1, pageSize: 0, total: 0, generatedAt: "2026-07-15T10:15:00Z", totals: {} },
  });
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([
    { id: "proj-a", label: "P01 · Bridge-04" },
    { id: "proj-b", label: "P02 · Tower-12" },
  ]);
  ccMock.mockResolvedValue([{ id: "cc-mat", label: "MAT · Materials" }]);
});

describe("Reports hub — browse strip + inline runner (FR-RPT-001/-002)", () => {
  it("lands on the idle prompt with the catalog loaded — nothing auto-opens", async () => {
    renderScreen();
    // Design artboard 1: the browse strip is populated but the right pane still
    // shows the prompt, and we never route away.
    await screen.findByTestId("report-catalog-browse");
    expect(await screen.findByTestId("reports-idle")).toHaveTextContent(
      /Select a report to begin\./i,
    );
    expect(screen.queryByTestId("tb-ledgers-viewer")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders the browse chrome — category tabs, the active tab's chips, and a search box", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    expect(screen.getByTestId("reports-search")).toBeInTheDocument();
    // A tab per category the role-filtered catalog returned; short design labels.
    expect(screen.getByTestId("catalog-tab-LEDGERS_REGISTERS")).toHaveTextContent(
      "Ledgers & registers",
    );
    expect(screen.getByTestId("catalog-tab-PROJECT_IPC")).toHaveTextContent("Project");
    // Only categories the catalog actually returned get a tab.
    expect(screen.queryByTestId("catalog-tab-INVENTORY")).not.toBeInTheDocument();
    // Chips are scoped to the active (first) tab.
    expect(screen.getByTestId("catalog-chip-trial-balance")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-chip-project-pnl")).not.toBeInTheDocument();
  });

  it("opens a report inline when its chip is picked, and syncs the breadcrumb", async () => {
    renderScreen();
    await userEvent.click(await screen.findByTestId("catalog-chip-trial-balance"));

    await screen.findByTestId("tb-ledgers-viewer");
    await screen.findByTestId("report-parameter-panel");
    await waitFor(() =>
      expect((screen.getByTestId("param-fy") as HTMLSelectElement).value).toBe("fy-1"),
    );
    expect(screen.queryByTestId("reports-idle")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    const crumb = await screen.findByTestId("breadcrumb");
    expect(within(crumb).getByText("Reports")).toBeInTheDocument();
    expect(within(crumb).getByText("Trial balance")).toBeInTheDocument();
  });

  it("switching tab swaps the chip row to that category's reports", async () => {
    renderScreen();
    await userEvent.click(await screen.findByTestId("catalog-tab-PROJECT_IPC"));
    expect(await screen.findByTestId("catalog-chip-project-pnl")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-chip-trial-balance")).not.toBeInTheDocument();
    // A tab alone doesn't open anything — the pane still shows the prompt.
    expect(screen.getByTestId("reports-idle")).toBeInTheDocument();
  });

  it("search matches across categories", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    await userEvent.type(screen.getByTestId("reports-search"), "salary");
    // HR sits in a different category than the active tab, yet still matches.
    expect(await screen.findByTestId("catalog-chip-salary-register")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-chip-trial-balance")).not.toBeInTheDocument();
  });
});

describe("Reports hub — role filtering (FR-RPT-008)", () => {
  it("defaults the tab to the first role-available category when LEDGERS is absent", async () => {
    // Simulate a role whose catalog only surfaces the PROJECT_IPC category — that
    // becomes the active tab, and no LEDGERS tab/chip is offered at all.
    catalogMock.mockResolvedValue([PROJECT_PNL]);
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByTestId("catalog-chip-project-pnl")).toBeInTheDocument();
    expect(screen.queryByTestId("catalog-tab-LEDGERS_REGISTERS")).not.toBeInTheDocument();

    // Picking it mounts the project viewer, not the ledgers one.
    await userEvent.click(screen.getByTestId("catalog-chip-project-pnl"));
    await screen.findByTestId("pi-viewer");
    expect(screen.queryByTestId("tb-ledgers-viewer")).not.toBeInTheDocument();
  });
});

describe("Reports hub — catalog error (FR-RPT-004)", () => {
  it("shows a catalog-level error + Retry when the catalog fails", async () => {
    catalogMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    expect(await screen.findByTestId("catalog-error")).toHaveTextContent(
      /Couldn't load the report list/i,
    );
    expect(screen.getByTestId("catalog-retry")).toBeInTheDocument();
  });
});

describe("Reports hub — read-only guarantee (FR-RPT-003)", () => {
  it("renders NO save/post/reverse/edit/delete affordance anywhere on the hub", async () => {
    renderScreen();
    // Open a report so the parameter panel + result chrome are in the tree too.
    await userEvent.click(await screen.findByTestId("catalog-chip-trial-balance"));
    await screen.findByTestId("report-parameter-panel");
    const container = screen.getByTestId("report-catalog-screen");
    // Word-boundary regex so "credit"/"debit" in labels don't false-match "edit".
    // "Cancel" is the parameter-panel filter-reset control, not a ledger mutation.
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
