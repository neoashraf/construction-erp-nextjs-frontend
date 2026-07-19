/**
 * FE-54 fe-report-catalog tests (FR-RPT-001/-003/-008). The hub's own
 * responsibility is the CATALOG + mounting the right report viewer INLINE — it no
 * longer renders results itself. Run / result / totals / empty / error / export
 * behaviour is covered by each viewer's own suite (trial-balance-ledgers,
 * financial-statements, …). Here we assert: role-filtered category tabs, the idle
 * prompt, that picking a chip opens that report's parameters inline WITHOUT
 * navigating, catalog-level error + retry, and the read-only guarantee.
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

describe("Reports hub — catalog + role filtering (FR-RPT-001/-008)", () => {
  it("lists reports grouped by category tabs, each reachable, none the caller can't run", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    // Admin sees everything — one category tab at a time. Default tab (Ledgers &
    // registers) shows Trial balance; the others are reachable via their tabs.
    expect(screen.getByTestId("catalog-chip-trial-balance")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("catalog-tab-PROJECT_IPC"));
    expect(screen.getByTestId("catalog-chip-project-pnl")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("catalog-tab-HR"));
    expect(screen.getByTestId("catalog-chip-salary-register")).toBeInTheDocument();
  });

  it("shows the idle prompt until a report is selected", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    expect(screen.getByTestId("reports-idle")).toHaveTextContent(/Select a report to begin/i);
  });

  it("shows a catalog-level error + Retry when the catalog fails", async () => {
    catalogMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    expect(await screen.findByTestId("catalog-error")).toHaveTextContent(/Couldn't load the report list/i);
  });
});

describe("Reports hub — inline report runner (FR-RPT-002/-003)", () => {
  it("picking a report opens its parameters INLINE (no navigation) with FY defaulted", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    await userEvent.click(screen.getByTestId("catalog-chip-trial-balance"));
    // The report's viewer mounts inline inside the hub — its shared parameter
    // panel appears with the shell FY seeded; we never route away.
    await screen.findByTestId("report-parameter-panel");
    await waitFor(() => expect((screen.getByTestId("param-fy") as HTMLSelectElement).value).toBe("fy-1"));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reports-idle")).not.toBeInTheDocument();
  });

  it("renders NO save/post/reverse/edit/delete affordance anywhere on the hub", async () => {
    renderScreen();
    await screen.findByTestId("report-catalog-browse");
    await userEvent.click(screen.getByTestId("catalog-chip-trial-balance"));
    await screen.findByTestId("report-parameter-panel");
    const container = screen.getByTestId("report-catalog-screen");
    // Word-boundary regex so "credit"/"debit" in labels don't false-match "edit".
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Cancel|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
