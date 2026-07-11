/**
 * FE-24 budget-vs-actual monitor tests (FR-CC-006/007/008/011/012/015/016).
 * View-mode grouping + switch, per-row budgeted/actual/variance/utilisation, status
 * classification, lifetime-vs-window note, required-selector + date validation, PM 403
 * scope, the full state matrix, and the read-only assertion.
 */
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type BudgetVsActualRow } from "@/features/cost-control/types";
import { BudgetVsActualScreen } from "@/features/cost-control/components/BudgetVsActualScreen";
import * as bvaApi from "@/features/cost-control/api/budget-vs-actual";
import * as optApi from "@/features/cost-control/api/masters-options";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
jest.mock("@/features/cost-control/api/budget-vs-actual", () => ({ getBudgetVsActual: jest.fn() }));
jest.mock("@/features/cost-control/api/masters-options", () => ({
  listProjectOptions: jest.fn(),
  listCostCentreOptions: jest.fn(),
  listFinancialYearOptions: jest.fn(),
}));

const getMock = bvaApi.getBudgetVsActual as jest.Mock;
const projMock = optApi.listProjectOptions as jest.Mock;
const ccMock = optApi.listCostCentreOptions as jest.Mock;
const fyMock = optApi.listFinancialYearOptions as jest.Mock;

const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04" }];
const COST_CENTRES = [
  { id: "cc-mat", code: "CC-01", name: "Materials — Cement & Steel", isActive: true },
  { id: "cc-fuel", code: "CC-03", name: "Fuel & Lubricants", isActive: true },
  { id: "cc-sub", code: "CC-04", name: "Subcontractor Works", isActive: true },
  { id: "cc-power", code: "CC-11", name: "Utilities & Site Power", isActive: true },
  { id: "cc-tmp", code: "CC-05", name: "অস্থায়ী কাজ — Temporary works", isActive: false },
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
const OK: BudgetVsActualRow = {
  projectId: "proj-a", costCentreId: "cc-sub", budgetedAmount: "900000000.0000",
  actualCost: "612000000.0000", variance: "288000000.0000", utilisationPct: "68.0000", status: "OK",
};
const UNBUDGETED: BudgetVsActualRow = {
  projectId: "proj-a", costCentreId: "cc-power", budgetedAmount: null,
  actualCost: "12000000.0000", variance: null, utilisationPct: null, status: "UNBUDGETED",
};

function bvaPage(rows: BudgetVsActualRow[], total = rows.length) {
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
        <BudgetVsActualScreen />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

async function pickProjectAndApply() {
  await screen.findByRole("option", { name: /Bridge-04/ });
  await userEvent.selectOptions(screen.getByTestId("bva-project"), "proj-a");
  await userEvent.click(screen.getByTestId("bva-apply"));
}

beforeEach(() => {
  getMock.mockReset();
  projMock.mockReset().mockResolvedValue(PROJECTS);
  ccMock.mockReset().mockResolvedValue(COST_CENTRES);
  fyMock.mockReset().mockResolvedValue(FYS);
});

describe("BudgetVsActualScreen — context gate + grouping (FR-CC-008)", () => {
  it("prompts to pick a project before firing any query", async () => {
    renderScreen();
    expect(await screen.findByTestId("bva-pick-context")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("renders cost-centre-grouped rows after selecting a project and applying", async () => {
    getMock.mockResolvedValue(bvaPage([OVER, APPROACHING, OK, UNBUDGETED]));
    renderScreen();
    await pickProjectAndApply();

    await screen.findByTestId("bva-table");
    // Names render in both the desktop grid and the mobile cards (both in the DOM).
    expect(screen.getAllByText("CC-01 — Materials — Cement & Steel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CC-04 — Subcontractor Works").length).toBeGreaterThan(0);
    expect(getMock).toHaveBeenCalledWith(expect.objectContaining({ projectId: "proj-a" }));
  });

  it("switches to By cost centre mode — swaps the fixed selector and clears context", async () => {
    renderScreen();
    await screen.findByTestId("bva-pick-context");
    await userEvent.click(screen.getByTestId("bva-mode-cost_centre"));
    expect(screen.getByTestId("bva-cost-centre")).toBeInTheDocument();
    expect(screen.queryByTestId("bva-project")).not.toBeInTheDocument();
    expect(screen.getByTestId("bva-pick-context")).toBeInTheDocument();
  });
});

describe("BudgetVsActualScreen — amounts + status (FR-CC-006/007/011/012/015)", () => {
  it("renders budgeted/actual and an em-dash budget for an unbudgeted row", async () => {
    getMock.mockResolvedValue(bvaPage([OVER, UNBUDGETED]));
    renderScreen();
    await pickProjectAndApply();
    await screen.findByTestId("bva-table");

    expect(screen.getAllByText("৳ 1,296,000,000.0000").length).toBeGreaterThan(0); // OVER actual
    const unbudgeted = screen.getAllByTestId("bva-row-UNBUDGETED")[0]!;
    expect(within(unbudgeted).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("classifies each status with a text-labelled badge", async () => {
    getMock.mockResolvedValue(bvaPage([OVER, APPROACHING, OK, UNBUDGETED]));
    renderScreen();
    await pickProjectAndApply();
    await screen.findByTestId("bva-table");

    expect(within(screen.getByTestId("bva-table")).getAllByTestId("cc-status-OVER")[0]).toHaveTextContent("Over budget");
    expect(within(screen.getByTestId("bva-table")).getAllByTestId("cc-status-APPROACHING")[0]).toHaveTextContent("Approaching");
    expect(within(screen.getByTestId("bva-table")).getAllByTestId("cc-status-UNBUDGETED")[0]).toHaveTextContent("Unbudgeted");
  });

  it("gives the utilisation bar an exact-percentage aria-label", async () => {
    getMock.mockResolvedValue(bvaPage([OVER]));
    renderScreen();
    await pickProjectAndApply();
    await screen.findByTestId("bva-table");
    expect(within(screen.getByTestId("bva-table")).getAllByLabelText("108% of budget used").length).toBeGreaterThan(0);
  });
});

describe("BudgetVsActualScreen — lifetime-vs-window note (spec §8)", () => {
  it("shows the note once a financial year is applied and does not change the status", async () => {
    getMock.mockResolvedValue(bvaPage([OVER]));
    renderScreen();
    await screen.findByRole("option", { name: /Bridge-04/ });
    await userEvent.selectOptions(screen.getByTestId("bva-project"), "proj-a");
    expect(screen.queryByTestId("bva-window-note")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByTestId("bva-fy"), "fy-2025-26");
    expect(screen.getByTestId("bva-window-note")).toHaveTextContent(/full lifetime spend/i);
  });
});

describe("BudgetVsActualScreen — validation (spec §7)", () => {
  it("blocks Apply and shows 'Select a project.' when none is chosen", async () => {
    renderScreen();
    await screen.findByRole("option", { name: /Bridge-04/ });
    await userEvent.click(screen.getByTestId("bva-apply"));
    expect(await screen.findByTestId("bva-project-error")).toHaveTextContent("Select a project.");
    expect(getMock).not.toHaveBeenCalled();
  });

  it("shows the date-order error when date-from is after date-to", async () => {
    renderScreen();
    await screen.findByRole("option", { name: /Bridge-04/ });
    await userEvent.selectOptions(screen.getByTestId("bva-project"), "proj-a");
    await userEvent.click(screen.getByTestId("bva-filters-toggle"));
    await userEvent.type(screen.getByTestId("bva-date-from"), "2026-06-30");
    await userEvent.type(screen.getByTestId("bva-date-to"), "2026-01-01");
    await userEvent.click(screen.getByTestId("bva-apply"));
    expect(await screen.findByTestId("bva-date-error")).toHaveTextContent("'Date from' must be before 'Date to'.");
  });
});

describe("BudgetVsActualScreen — state matrix (spec §6)", () => {
  it("no-budgets empty variant when all statuses are on and nothing comes back", async () => {
    getMock.mockResolvedValue(bvaPage([]));
    renderScreen();
    await pickProjectAndApply();
    expect(await screen.findByTestId("bva-empty-nobudgets")).toHaveTextContent(/No budgets have been set/i);
  });

  it("filtered-empty variant when a status filter is narrowed and nothing matches", async () => {
    getMock.mockResolvedValue(bvaPage([]));
    renderScreen();
    await screen.findByRole("option", { name: /Bridge-04/ });
    await userEvent.selectOptions(screen.getByTestId("bva-project"), "proj-a");
    await userEvent.click(screen.getByTestId("bva-status-OK")); // deselect OK → narrowed
    await userEvent.click(screen.getByTestId("bva-apply"));
    expect(await screen.findByTestId("bva-empty-filtered")).toHaveTextContent(/No cost centres match/i);
  });

  it("error + retry refetches", async () => {
    getMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }));
    getMock.mockResolvedValueOnce(bvaPage([OK]));
    renderScreen();
    await pickProjectAndApply();
    const retry = await screen.findByTestId("bva-retry");
    await userEvent.click(retry);
    await screen.findByTestId("bva-table");
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("renders the project-scope denied view on a 403 (FR-CC-016)", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }));
    renderScreen("PROJECT_MANAGER");
    await pickProjectAndApply();
    expect(await screen.findByTestId("bva-forbidden")).toHaveTextContent(/don't have access to this project/i);
  });
});

describe("BudgetVsActualScreen — read-only (SRS §10)", () => {
  it("exposes no create/save/post/delete affordance", async () => {
    getMock.mockResolvedValue(bvaPage([OK]));
    renderScreen();
    await pickProjectAndApply();
    await screen.findByTestId("bva-table");
    for (const name of [/new/i, /save/i, /post/i, /delete/i, /create/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
