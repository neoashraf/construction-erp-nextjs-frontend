/**
 * FE-26 cost-centre profitability tests (FR-CC-009/010). Revenue/cost/profit per row, no
 * status/badge concept, grouping-mode switch + filter persistence, Profit sort, the
 * loss "(loss)" qualifier, role gating (only Admin/Accounts Manager), and the state matrix.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type ProfitabilityRow } from "@/features/cost-control/types";
import { ProfitabilityScreen } from "@/features/cost-control/components/ProfitabilityScreen";
import * as profitApi from "@/features/cost-control/api/profitability";
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
jest.mock("@/features/cost-control/api/profitability", () => ({ getProfitability: jest.fn() }));
jest.mock("@/features/cost-control/api/masters-options", () => ({
  listProjectOptions: jest.fn(),
  listCostCentreOptions: jest.fn(),
  listFinancialYearOptions: jest.fn(),
}));

const getMock = profitApi.getProfitability as jest.Mock;
const projMock = optApi.listProjectOptions as jest.Mock;
const ccMock = optApi.listCostCentreOptions as jest.Mock;
const fyMock = optApi.listFinancialYearOptions as jest.Mock;

const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04" }];
const COST_CENTRES = [
  { id: "cc-mat", code: "CC-01", name: "Materials — Cement & Steel", isActive: true },
  { id: "cc-sub", code: "CC-04", name: "Subcontractor Works", isActive: true },
  { id: "cc-tmp", code: "CC-05", name: "অস্থায়ী কাজ — Temporary works", isActive: false },
];
const FYS = [{ id: "fy-2025-26", label: "FY 2025–26", isActive: true }];

const PROFIT_ROW: ProfitabilityRow = {
  projectId: null, costCentreId: "cc-sub", revenue: "960000000.0000", cost: "772000000.0000", profit: "188000000.0000",
};
const LOSS_ROW: ProfitabilityRow = {
  projectId: null, costCentreId: "cc-mat", revenue: "480000000.0000", cost: "618000000.0000", profit: "-138000000.0000",
};
const INACTIVE_ROW: ProfitabilityRow = {
  projectId: null, costCentreId: "cc-tmp", revenue: "82000000.0000", cost: "67600000.0000", profit: "14400000.0000",
};

function profitPage(rows: ProfitabilityRow[], total = rows.length) {
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
        <ProfitabilityScreen />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(profitPage([PROFIT_ROW, LOSS_ROW, INACTIVE_ROW]));
  projMock.mockReset().mockResolvedValue(PROJECTS);
  ccMock.mockReset().mockResolvedValue(COST_CENTRES);
  fyMock.mockReset().mockResolvedValue(FYS);
});

describe("ProfitabilityScreen — revenue/cost/profit (FR-CC-009)", () => {
  it("loads at the default grouping on mount and renders profit figures", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    expect(getMock).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "cost_centre" }));
    expect(screen.getAllByText("৳ 960,000,000.0000").length).toBeGreaterThan(0);
  });

  it("shows a loss row with a '(loss)' text qualifier — never colour-only (§10)", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    const lossRow = within(screen.getByTestId("profit-table")).getAllByTestId("profit-row-loss")[0]!;
    expect(lossRow).toHaveTextContent("(loss)");
    expect(lossRow).toHaveTextContent("৳ -138,000,000.0000");
  });

  it("renders NO status/badge concept anywhere (unlike the budget-vs-actual monitor)", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    expect(screen.queryByText("Over budget")).not.toBeInTheDocument();
    expect(screen.queryByText("Approaching")).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid^="cc-status-"]')).toBeNull();
  });

  it("flags an inactive cost centre but still renders its row", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    expect(screen.getAllByText("(inactive)").length).toBeGreaterThan(0);
  });
});

describe("ProfitabilityScreen — grouping + sort (spec §5/§9)", () => {
  it("switches groupBy and keeps an applied project filter across the mode change", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    await userEvent.selectOptions(screen.getByTestId("profit-project"), "proj-a");
    await userEvent.click(screen.getByTestId("profit-apply"));
    await userEvent.click(screen.getByTestId("profit-mode-project"));
    expect(getMock).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: "project", projectId: "proj-a" }));
  });

  it("sorts by Profit ascending to surface the worst performer first", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    await userEvent.click(screen.getByTestId("profit-sort")); // → ascending
    const rows = within(screen.getByTestId("profit-table")).getAllByTestId(/^profit-row(-loss)?$/);
    expect(rows[0]).toHaveAttribute("data-testid", "profit-row-loss");
  });
});

describe("ProfitabilityScreen — role gating (spec §11, Open item 1)", () => {
  it("blocks a project manager with the no-access view and fires no query", async () => {
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByTestId("profit-forbidden")).toHaveTextContent(/don't have access to profitability/i);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("blocks a non-CC role (site engineer) the same way", async () => {
    renderScreen("SITE_ENGINEER");
    expect(await screen.findByTestId("profit-forbidden")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("admits an admin", async () => {
    renderScreen("ADMIN");
    await screen.findByTestId("profit-table");
    expect(getMock).toHaveBeenCalled();
  });
});

describe("ProfitabilityScreen — state matrix + drill (spec §6)", () => {
  it("shows the single empty-state copy when nothing is posted", async () => {
    getMock.mockResolvedValue(profitPage([]));
    renderScreen();
    expect(await screen.findByTestId("profit-empty")).toHaveTextContent(/No revenue or cost has been posted/i);
  });

  it("error + retry refetches", async () => {
    getMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }));
    getMock.mockResolvedValueOnce(profitPage([PROFIT_ROW]));
    renderScreen();
    const retry = await screen.findByTestId("profit-retry");
    await userEvent.click(retry);
    await screen.findByTestId("profit-table");
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("drills a row into the account ledger (both INCOME + EXPENSE)", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    const drill = within(screen.getByTestId("profit-table")).getAllByTestId("profit-drill")[0]!;
    expect(drill).toHaveAttribute("href", expect.stringContaining("/ledger/account-ledger?costCentreId=cc-sub"));
  });

  it("exposes no create/save/post/delete affordance (read-only)", async () => {
    renderScreen();
    await screen.findByTestId("profit-table");
    for (const name of [/new/i, /save/i, /post/i, /delete/i, /create/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
