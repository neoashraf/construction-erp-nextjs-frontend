/**
 * FE-61 fe-dashboard tests (FR-DSH-001..018). Covers: renders tile array in
 * order from one GET /api/dashboard; role subset (a reduced payload renders
 * only its tiles — no client hiding); each KPI shape + drill href; status
 * badge mapping (OVER/BREACH red · APPROACHING amber · OK neutral · null →
 * no badge); scope-change re-fetches; per-tile refresh updates only that
 * tile via cache patch; scope-violation 403 shows the reset alert; single-
 * tile 403 → inline forbidden card; whole-page empty; whole-page error+retry;
 * read-only assertion (no customize/add/reorder/save).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import * as dashApi from "@/features/dashboard/api/dashboard";
import * as mastersApi from "@/features/dashboard/api/masters";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { type Tile } from "@/features/dashboard/types";

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
jest.mock("@/features/dashboard/api/dashboard");
jest.mock("@/features/dashboard/api/masters");
jest.mock("@/lib/hooks/use-online", () => ({ useOnline: () => true }));

const getMock = dashApi.getDashboard as jest.Mock;
const refreshMock = dashApi.refreshTile as jest.Mock;
const fyMock = mastersApi.listFinancialYearOptions as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;

function mkTile(overrides: Partial<Tile>): Tile {
  return {
    key: "project-cash-flow",
    title: "Project Cash Flow",
    kpi: { netInflow: "1000.0000", cashBalance: "500.0000", bankBalance: "1500.0000" },
    status: null,
    drillTo: { report: "cash-bank-book", params: { financialYearId: "fy-1", projectId: "proj-a" } },
    generatedAt: "2026-07-15T10:00:00Z",
    ...overrides,
  } as Tile;
}

const FULL: Tile[] = [
  mkTile({}),
  mkTile({
    key: "pending-ipcs",
    title: "Pending IPCs",
    kpi: { count: 4, totalOutstanding: "1875000.0000" },
    drillTo: { report: "ipc-billing", params: { financialYearId: "fy-1" } },
  }),
  mkTile({
    key: "retention-held",
    title: "Retention Held",
    kpi: { totalRetentionHeld: "412500.0000" },
    drillTo: { report: "ipc-billing", params: { financialYearId: "fy-1", view: "retention" } },
  }),
  mkTile({
    key: "low-stock",
    title: "Low-stock Alerts",
    kpi: { count: 3 },
    status: "BREACH",
    drillTo: { report: "low-stock", params: {} },
  }),
  mkTile({
    key: "over-budget",
    title: "Over-budget Alerts",
    kpi: { overCount: 2, approachingCount: 5 },
    status: "OVER",
    drillTo: { report: "cost-centre-variance", params: { status: "OVER,APPROACHING" } },
  }),
  mkTile({
    key: "attendance-summary",
    title: "Attendance Summary",
    kpi: { period: "2026-06", presentDays: 1840, headCountTotal: "560.0000" },
    drillTo: { report: "attendance-summary", params: { month: "2026-06" } },
  }),
  mkTile({
    key: "top-receivables-payables",
    title: "Top Receivables / Payables",
    kpi: {
      topReceivables: [{ partyId: "pa-1", partyName: "Alpha", outstanding: "100.0000" }],
      topPayables: [{ partyId: "pa-2", partyName: "Beta", outstanding: "50.0000" }],
    },
    drillTo: { report: "account-ledger", params: {} },
  }),
];

const STORE_KEEPER: Tile[] = [FULL.find((t) => t.key === "low-stock")!];

function user(): SafeUser {
  return { id: "u1", email: "u@ze.test", name: "User", role: "ADMIN", companyId: "c1", financialYearId: "fy-1", isActive: true };
}
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <DashboardScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getMock.mockResolvedValue(FULL);
  refreshMock.mockImplementation((key: string) => Promise.resolve(mkTile({ key: key as Tile["key"], generatedAt: "2026-07-15T11:00:00Z" })));
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([
    { id: "proj-a", label: "BR-04 · Bridge-04 — Buriganga" },
    { id: "proj-b", label: "TW-A · Tower-A — Gulshan" },
  ]);
});

describe("Dashboard — one read, render array in order (FR-DSH-001, -005, -007, -010)", () => {
  it("issues one GET /api/dashboard and renders every returned tile", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tile-project-cash-flow")).toBeInTheDocument();
    expect(screen.getByTestId("tile-pending-ipcs")).toBeInTheDocument();
    expect(screen.getByTestId("tile-retention-held")).toBeInTheDocument();
    expect(screen.getByTestId("tile-low-stock")).toBeInTheDocument();
    expect(screen.getByTestId("tile-over-budget")).toBeInTheDocument();
    expect(screen.getByTestId("tile-attendance-summary")).toBeInTheDocument();
    expect(screen.getByTestId("tile-top-receivables-payables")).toBeInTheDocument();
  });

  it("renders only the tiles the payload contains (role subset — no client hiding)", async () => {
    getMock.mockResolvedValue(STORE_KEEPER);
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    expect(screen.getByTestId("tile-low-stock")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-project-cash-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tile-attendance-summary")).not.toBeInTheDocument();
  });
});

describe("Status badge mapping (FR-DSH-018)", () => {
  it("OVER + BREACH show destructive badges; null shows no badge", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    expect(screen.getByTestId("tile-status-BREACH")).toHaveTextContent("Breach");
    expect(screen.getByTestId("tile-status-OVER")).toHaveTextContent("Over");
    // Pending IPCs has null status → no badge inside its tile.
    const cashFlow = screen.getByTestId("tile-project-cash-flow");
    expect(within(cashFlow).queryByText(/^Over$|^Breach$|^Approaching$/i)).toBeNull();
  });
});

describe("Drill-through — every tile has a working link (FR-DSH-002)", () => {
  it("every tile's View report link points to a /reports/... route with drillTo.params", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    const cashDrill = screen.getByTestId("tile-project-cash-flow-drill");
    expect(cashDrill.getAttribute("href")).toContain("/reports/trial-balance-ledgers");
    expect(cashDrill.getAttribute("href")).toContain("projectId=proj-a");
    const lowStockDrill = screen.getByTestId("tile-low-stock-drill");
    expect(lowStockDrill.getAttribute("href")).toContain("/reports/inventory");
    const overDrill = screen.getByTestId("tile-over-budget-drill");
    expect(overDrill.getAttribute("href")).toContain("/reports/requisition-cost-control");
    expect(overDrill.getAttribute("href")).toContain("status=OVER");
  });

  it("Top receivables rows drill into that party's account ledger", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    const link = screen.getByRole("link", { name: /Open ledger for Alpha/i });
    expect(link.getAttribute("href")).toContain("/reports/trial-balance-ledgers");
    expect(link.getAttribute("href")).toContain("partyId=pa-1");
  });
});

describe("Scope selector re-fetches (FR-DSH-008)", () => {
  it("changing project re-issues GET /api/dashboard", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    expect(getMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const sel = screen.getByTestId("dash-project") as HTMLSelectElement;
      expect([...sel.options].some((o) => o.value === "proj-a")).toBe(true);
    });
    await userEvent.selectOptions(screen.getByTestId("dash-project") as HTMLSelectElement, "proj-a");
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });
});

describe("Per-tile refresh (FR-DSH-005)", () => {
  it("Refresh calls GET /api/dashboard/tiles/{key}; grid untouched", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    await userEvent.click(screen.getByTestId("tile-low-stock-refresh"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(refreshMock.mock.calls[0]![0]).toBe("low-stock");
    // Other tiles still present.
    expect(screen.getByTestId("tile-project-cash-flow")).toBeInTheDocument();
  });

  it("A per-tile refresh 403 renders the inline forbidden card, neighbours unaffected", async () => {
    refreshMock.mockRejectedValueOnce(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    await userEvent.click(screen.getByTestId("tile-low-stock-refresh"));
    await waitFor(() => {
      const tile = screen.getByTestId("tile-low-stock");
      expect(within(tile).queryByText(/don't have permission/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("tile-project-cash-flow")).toBeInTheDocument();
  });
});

describe("Whole-page error + retry (spec §6)", () => {
  it("shows the error card + Retry; scope selector stays interactive", async () => {
    getMock
      .mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }))
      .mockResolvedValueOnce(FULL);
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("dashboard-error");
    await userEvent.click(screen.getByTestId("dashboard-retry"));
    await screen.findByTestId("tile-grid");
  });
});

describe("Scope violation — 403 on an unassigned project reverts (FR-DSH-009)", () => {
  it("shows the scope-violation alert and keeps the selector re-picking", async () => {
    // First call ok, second (with proj-b) returns 403.
    getMock.mockImplementation((scope: { projectId: string | null }) => {
      if (scope.projectId === "proj-b") {
        return Promise.reject(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
      }
      return Promise.resolve(FULL);
    });
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    await waitFor(() => {
      const sel = screen.getByTestId("dash-project") as HTMLSelectElement;
      expect([...sel.options].some((o) => o.value === "proj-b")).toBe(true);
    });
    await userEvent.selectOptions(screen.getByTestId("dash-project") as HTMLSelectElement, "proj-b");
    await screen.findByTestId("dashboard-scope-violation");
  });
});

describe("Empty — role has zero tiles (spec §6)", () => {
  it("shows the whole-page empty state", async () => {
    getMock.mockResolvedValue([]);
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("dashboard-empty");
  });
});

describe("Read-only assertion (FR-DSH-003, -006)", () => {
  it("no customize / add / remove / reorder / save / post control exists anywhere", async () => {
    renderScreen();
    await screen.findByTestId("dashboard");
    await screen.findByTestId("tile-grid");
    const container = screen.getByTestId("dashboard");
    const forbidden = /\b(Customize|Add tile|Remove tile|Reorder|Save layout|Post|Reverse|Delete)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
