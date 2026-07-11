/**
 * FE-25 over-budget alerts tests (FR-CC-011/012/015/016). Severity sort, status-chip
 * filtering (incl. the can't-empty guard), the two distinct empty states (good-news vs
 * filtered), manual refresh, PM scope (no project filter), the 403 project-scope view,
 * and the read-only assertion.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type BudgetVsActualRow } from "@/features/cost-control/types";
import { OverBudgetAlertsScreen } from "@/features/cost-control/components/OverBudgetAlertsScreen";
import * as alertsApi from "@/features/cost-control/api/alerts";
import * as optApi from "@/features/cost-control/api/masters-options";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/cost-control/api/alerts", () => ({ getOverBudgetAlerts: jest.fn() }));
jest.mock("@/features/cost-control/api/masters-options", () => ({
  listProjectOptions: jest.fn(),
  listCostCentreOptions: jest.fn(),
  listFinancialYearOptions: jest.fn(),
}));

const getMock = alertsApi.getOverBudgetAlerts as jest.Mock;
const projMock = optApi.listProjectOptions as jest.Mock;
const ccMock = optApi.listCostCentreOptions as jest.Mock;
const fyMock = optApi.listFinancialYearOptions as jest.Mock;

const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04" }];
const COST_CENTRES = [
  { id: "cc-mat", code: "CC-01", name: "Materials — Cement & Steel", isActive: true },
  { id: "cc-fuel", code: "CC-03", name: "Fuel & Lubricants", isActive: false },
  { id: "cc-lab", code: "CC-02", name: "শ্রমিক মজুরি — Site Labour", isActive: true },
];
const FYS = [{ id: "fy-2025-26", label: "FY 2025–26", isActive: true }];

const OVER: BudgetVsActualRow = {
  projectId: "proj-a", costCentreId: "cc-mat", budgetedAmount: "1200000000.0000",
  actualCost: "1296000000.0000", variance: "-96000000.0000", utilisationPct: "108.0000", status: "OVER",
};
const APPROACHING: BudgetVsActualRow = {
  projectId: "proj-a", costCentreId: "cc-fuel", budgetedAmount: "120000000.0000",
  actualCost: "111000000.0000", variance: "9000000.0000", utilisationPct: "92.5000", status: "APPROACHING",
};

function alertsPage(rows: BudgetVsActualRow[], total = rows.length) {
  return { data: rows, page: 1, pageSize: 25, total };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-2025-26", isActive: true };
}

function renderScreen(role: Role = "ACCOUNTS_TEAM") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <OverBudgetAlertsScreen />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(alertsPage([APPROACHING, OVER]));
  projMock.mockReset().mockResolvedValue(PROJECTS);
  ccMock.mockReset().mockResolvedValue(COST_CENTRES);
  fyMock.mockReset().mockResolvedValue(FYS);
});

describe("OverBudgetAlertsScreen — load + severity sort (FR-CC-011/012)", () => {
  it("fires the query on mount and sorts OVER before APPROACHING regardless of payload order", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    const table = screen.getByTestId("alerts-table");
    const rows = within(table).getAllByTestId(/^alerts-row-(OVER|APPROACHING)$/);
    expect(rows[0]).toHaveAttribute("data-testid", "alerts-row-OVER");
    expect(rows[1]).toHaveAttribute("data-testid", "alerts-row-APPROACHING");
  });

  it("resolves MAS names for both dimensions and flags an inactive cost centre", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    expect(screen.getAllByText("CC-01 — Materials — Cement & Steel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BR-04 — Bridge-04 — Buriganga").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(inactive)").length).toBeGreaterThan(0); // cc-fuel is inactive
  });
});

describe("OverBudgetAlertsScreen — status chips (spec §7)", () => {
  it("narrows the query to OVER when Approaching is toggled off", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    await userEvent.click(screen.getByTestId("alerts-status-APPROACHING"));
    expect(getMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "OVER" }));
  });

  it("blocks unchecking the last active chip (can't run a status-less query)", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    await userEvent.click(screen.getByTestId("alerts-status-OVER")); // → [APPROACHING]
    await userEvent.click(screen.getByTestId("alerts-status-APPROACHING")); // blocked
    expect(screen.getByTestId("alerts-status-APPROACHING")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("OverBudgetAlertsScreen — empty states (spec §6/§10)", () => {
  it("shows the positive good-news empty state when nothing is over budget at default filters", async () => {
    getMock.mockResolvedValue(alertsPage([]));
    renderScreen();
    expect(await screen.findByTestId("alerts-empty-none")).toHaveTextContent(/Nothing to flag/i);
    expect(screen.queryByTestId("alerts-empty-filtered")).not.toBeInTheDocument();
  });

  it("shows the neutral filtered-empty state when a filter is applied and nothing matches", async () => {
    getMock.mockResolvedValue(alertsPage([]));
    renderScreen();
    await screen.findByTestId("alerts-empty-none");
    await userEvent.click(screen.getByTestId("alerts-status-APPROACHING")); // narrow → filtered
    expect(await screen.findByTestId("alerts-empty-filtered")).toHaveTextContent(/No alerts match this filter/i);
  });
});

describe("OverBudgetAlertsScreen — refresh (spec §9)", () => {
  it("re-reads on manual Refresh and shows a last-checked indicator", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    expect(screen.getByTestId("alerts-last-checked")).toHaveTextContent(/Last checked/i);
    const before = getMock.mock.calls.length;
    await userEvent.click(screen.getByTestId("alerts-refresh"));
    expect(getMock.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("OverBudgetAlertsScreen — PM scope + 403 (FR-CC-016)", () => {
  it("hides the project filter for a project manager (server-scoped)", async () => {
    renderScreen("PROJECT_MANAGER");
    await screen.findByTestId("alerts-table");
    expect(screen.queryByTestId("alerts-project")).not.toBeInTheDocument();
  });

  it("renders the project-scope denied view when a project filter is forbidden", async () => {
    getMock.mockResolvedValue(alertsPage([APPROACHING, OVER]));
    renderScreen("ACCOUNTS_TEAM");
    await screen.findByRole("option", { name: /Bridge-04/ });
    getMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }));
    await userEvent.selectOptions(screen.getByTestId("alerts-project"), "proj-a");
    expect(await screen.findByTestId("alerts-forbidden")).toHaveTextContent(/don't have access to this project/i);
  });
});

describe("OverBudgetAlertsScreen — read-only + drill (SRS §10, spec §5)", () => {
  it("exposes no acknowledge/snooze/dismiss or create/save/post affordance", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    for (const name of [/acknowledge/i, /snooze/i, /dismiss/i, /new/i, /save/i, /post/i, /delete/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("drills a row into the account ledger for its (project, cost centre) pair", async () => {
    renderScreen();
    await screen.findByTestId("alerts-table");
    const drill = within(screen.getByTestId("alerts-table")).getAllByTestId("alerts-drill")[0]!;
    expect(drill).toHaveAttribute("href", expect.stringContaining("/ledger/account-ledger?projectId=proj-a&costCentreId=cc-mat"));
  });
});
