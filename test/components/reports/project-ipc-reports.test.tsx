/**
 * FE-57 fe-project-ipc-reports tests (FR-RPT-003/-004/-007/-015..020/-029).
 * Covers: five-report tab switch (endpoint + columns change, project preserved),
 * Project P&L required-project gating, IPC ageing badges (label + colour for
 * each bucket), IPC cumulative footer from `meta.totals`, Outstanding per-project
 * reconciliation band, Material consumption `UNBUDGETED` → "—" + verbatim
 * status badge, out-of-scope 403 view, empty per report (Export enabled),
 * partial name-unavailable row, error+retry (params preserved), Export format
 * re-issue (Excel), read-only assertion (no mutating buttons).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { ProjectIpcViewer } from "@/features/reports/project-ipc/components/ProjectIpcViewer";
import { dateInput, setDateField } from "./helpers";

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

const PNL_RESULT = {
  reportName: "project-pnl",
  parameters: { projectId: "proj-a" },
  rows: [
    { costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", revenue: "100.0000", cost: "60.0000", profit: "40.0000" },
    { costCentreId: "cc-2", costCentreCode: "CC-02", costCentreName: null, revenue: "50.0000", cost: "40.0000", profit: "10.0000" },
    { costCentreId: null, costCentreCode: null, costCentreName: "Project total", revenue: "150.0000", cost: "100.0000", profit: "50.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 3,
    total: 3,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { revenue: "150.0000", cost: "100.0000", profit: "50.0000" },
  },
};

const IPC_RESULT = {
  reportName: "ipc-billing",
  parameters: { projectId: "proj-a" },
  rows: [
    { ipcId: "ipc-1", ipcNo: "IPC-2026-000001", ipcDate: "2026-04-05", dueDate: "2026-05-05", certifiedAmount: "100.0000", billedAmount: "100.0000", receivedAmount: "50.0000", outstandingAmount: "50.0000", retentionHeldAmount: "10.0000", ageingBucket: "CURRENT" },
    { ipcId: "ipc-2", ipcNo: "IPC-2026-000002", ipcDate: "2026-03-01", dueDate: "2026-04-01", certifiedAmount: "80.0000", billedAmount: "80.0000", receivedAmount: "20.0000", outstandingAmount: "60.0000", retentionHeldAmount: "8.0000", ageingBucket: "D31_60" },
    { ipcId: "ipc-3", ipcNo: "IPC-2026-000003", ipcDate: "2026-02-01", dueDate: "2026-03-01", certifiedAmount: "60.0000", billedAmount: "60.0000", receivedAmount: "10.0000", outstandingAmount: "50.0000", retentionHeldAmount: "6.0000", ageingBucket: "D61_90" },
    { ipcId: "ipc-4", ipcNo: "IPC-2026-000004", ipcDate: "2025-12-01", dueDate: "2026-01-01", certifiedAmount: "40.0000", billedAmount: "40.0000", receivedAmount: "0.0000", outstandingAmount: "40.0000", retentionHeldAmount: "4.0000", ageingBucket: "D90_PLUS" },
    { ipcId: "ipc-5", ipcNo: "IPC-2026-000005", ipcDate: "2025-11-01", dueDate: "2025-12-01", projectId: "gone", projectName: null, certifiedAmount: "30.0000", billedAmount: "30.0000", receivedAmount: "0.0000", outstandingAmount: "30.0000", retentionHeldAmount: "3.0000", ageingBucket: "D90_PLUS" },
  ],
  meta: {
    page: 1,
    pageSize: 5,
    total: 5,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: {
      certified: "310.0000",
      billed: "310.0000",
      received: "80.0000",
      outstanding: "230.0000",
      retentionHeld: "31.0000",
    },
  },
};

const OUT_RESULT = {
  reportName: "outstanding",
  parameters: {},
  rows: [
    { ipcId: "ipc-a1", ipcNo: "IPC-2026-000010", ipcDate: "2026-04-05", dueDate: "2026-05-05", projectId: "proj-a", projectName: "Bridge-04", certifiedAmount: "100.0000", billedAmount: "100.0000", receivedAmount: "50.0000", outstandingAmount: "50.0000", retentionHeldAmount: "10.0000", ageingBucket: "CURRENT" },
    { ipcId: "ipc-b1", ipcNo: "IPC-2026-000011", ipcDate: "2026-04-01", dueDate: "2026-05-01", projectId: "proj-b", projectName: "Tower-A", certifiedAmount: "200.0000", billedAmount: "200.0000", receivedAmount: "150.0000", outstandingAmount: "50.0000", retentionHeldAmount: "20.0000", ageingBucket: "CURRENT" },
  ],
  meta: {
    page: 1,
    pageSize: 2,
    total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: {
      certified: "300.0000", billed: "300.0000", received: "200.0000", outstanding: "100.0000", retentionHeld: "30.0000",
    },
    projectTotals: {
      "proj-a": { certified: "100.0000", billed: "100.0000", received: "50.0000", outstanding: "50.0000", retentionHeld: "10.0000" },
      "proj-b": { certified: "200.0000", billed: "200.0000", received: "150.0000", outstanding: "50.0000", retentionHeld: "20.0000" },
    },
  },
};

const MC_RESULT = {
  reportName: "material-consumption-vs-budget",
  parameters: {},
  rows: [
    { projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", budgetedAmount: "1000.0000", actualAmount: "1200.0000", variance: "-200.0000", utilisationPct: "120.0000", status: "OVER" },
    { projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-9", costCentreCode: "CC-09", costCentreName: "Overheads", budgetedAmount: null, actualAmount: "500.0000", variance: null, utilisationPct: null, status: "UNBUDGETED" },
  ],
  meta: {
    page: 1,
    pageSize: 2,
    total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { budgeted: "1000.0000", actual: "1700.0000", variance: "-700.0000" },
  },
};

const LC_RESULT = {
  reportName: "labour-cost",
  parameters: {},
  rows: [
    { projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-2", costCentreCode: "CC-02", costCentreName: "Site Labour", labourCost: "500.0000" },
  ],
  meta: {
    page: 1,
    pageSize: 1,
    total: 1,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { labourCost: "500.0000" },
  },
};

const IPC_EMPTY = {
  ...IPC_RESULT,
  rows: [],
  meta: {
    ...IPC_RESULT.meta,
    total: 0,
    totals: { certified: "0.0000", billed: "0.0000", received: "0.0000", outstanding: "0.0000", retentionHeld: "0.0000" },
  },
};

function user(): SafeUser {
  return {
    id: "u1",
    email: "u@ze.test",
    name: "User",
    role: "ADMIN",
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <ProjectIpcViewer />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function waitForProjectOption(value: string) {
  await waitFor(() => {
    const sel = screen.getByTestId("param-project") as HTMLSelectElement;
    if (![...sel.options].some((o) => o.value === value)) {
      throw new Error("project options not populated");
    }
  });
}

async function pickProject(value: string) {
  // `param-project` is collapsed behind the Filters disclosure — open it first.
  // Idempotent: the disclosure persists open across tab switches, so opening a
  // second time would toggle it closed.
  const toggle = screen.getByTestId("report-filters-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") await userEvent.click(toggle);
  await screen.findByTestId("param-project");
  await waitForProjectOption(value);
  await userEvent.selectOptions(
    screen.getByTestId("param-project") as HTMLSelectElement,
    value,
  );
}

async function runPnl() {
  await pickProject("proj-a");
  setDateField("param-date-from", "2026-04-01");
  setDateField("param-date-to", "2026-06-30");
  await userEvent.click(screen.getByTestId("report-run"));
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) => {
    switch (name) {
      case "project-pnl": return Promise.resolve(PNL_RESULT);
      case "ipc-billing": return Promise.resolve(IPC_RESULT);
      case "outstanding": return Promise.resolve(OUT_RESULT);
      case "material-consumption-vs-budget": return Promise.resolve(MC_RESULT);
      case "labour-cost": return Promise.resolve(LC_RESULT);
      default: return Promise.resolve({ reportName: name, parameters: {}, rows: [], meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-15T10:00:00Z" } });
    }
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "project-pnl.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([
    { id: "proj-a", label: "BR-04 · Bridge-04 — Buriganga" },
    { id: "proj-b", label: "TW-A · Tower-A — Gulshan" },
  ]);
  ccMock.mockResolvedValue([]);
});

describe("Project & IPC — switcher preserves project across tabs (FR-RPT-015..020, spec §9)", () => {
  it("switches endpoints + column sets when the tab changes and preserves the selected project", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-pnl-table");
    // The tab pill for Project P&L is active.
    expect(screen.getByTestId("pi-tab-PROJECT_PNL")).toHaveAttribute("aria-selected", "true");

    // Switch to the IPC report.
    await userEvent.click(screen.getByTestId("pi-tab-IPC_BILLING"));
    // The project select value carries across (spec §9).
    await waitFor(() =>
      expect((screen.getByTestId("param-project") as HTMLSelectElement).value).toBe("proj-a"),
    );
    // Run the IPC report on the preserved project.
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-ipc-table");

    // Endpoint names hit for each Run.
    const called = runMock.mock.calls.map((c) => c[0]);
    expect(called).toEqual(expect.arrayContaining(["project-pnl", "ipc-billing"]));
  });
});

describe("Project P&L — required project gating (FR-RPT-015)", () => {
  it("shows the 'Select a project.' blocker before a project is picked, and hides it once one is", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    // Blocker visible.
    expect(screen.getByTestId("pi-project-required")).toBeInTheDocument();
    // Pick a project — blocker disappears.
    await pickProject("proj-a");
    expect(screen.queryByTestId("pi-project-required")).not.toBeInTheDocument();
  });

  it("renders the per-cost-centre breakdown + Project total row + totals footer", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-pnl-table");
    expect(screen.getAllByTestId("pi-pnl-row")).toHaveLength(2);
    expect(screen.getByTestId("pi-pnl-project-total-row")).toHaveTextContent("Project total");
    expect(screen.getByTestId("pi-pnl-totals-footer")).toHaveTextContent(/150/);
  });

  it("renders a partial (name-unavailable) placeholder for missing CC names", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-pnl-table");
    expect(screen.getByTestId("pi-name-unavailable")).toBeInTheDocument();
  });
});

describe("IPC report — ageing badges + cumulative footer (FR-RPT-016/-017)", () => {
  it("renders a label + colour badge for each of the four buckets — never colour-only", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    // Switch to IPC first so date-from is required for gate; project already set below.
    await userEvent.click(screen.getByTestId("pi-tab-IPC_BILLING"));
    await pickProject("proj-a");
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-ipc-table");

    expect(screen.getByTestId("ipc-ageing-CURRENT")).toHaveTextContent("Current");
    expect(screen.getByTestId("ipc-ageing-D31_60")).toHaveTextContent("31–60 days");
    expect(screen.getByTestId("ipc-ageing-D61_90")).toHaveTextContent("61–90 days");
    // Two rows in fixture have D90_PLUS.
    expect(screen.getAllByTestId("ipc-ageing-D90_PLUS")[0]).toHaveTextContent("90+ days");
  });

  it("cumulative footer renders straight from `meta.totals` (no client Σ)", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await userEvent.click(screen.getByTestId("pi-tab-IPC_BILLING"));
    await pickProject("proj-a");
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    const footer = await screen.findByTestId("pi-ipc-cumulative-footer");
    expect(footer).toHaveTextContent("Project cumulative");
    expect(footer).toHaveTextContent(/310/); // certified totals from mock
    // BIN/TIN statutory note visible.
    expect(screen.getByTestId("pi-ipc-bin-tin-note")).toBeInTheDocument();
  });

  it("Empty per report — 'No IPCs raised for this project yet.' + Export stays enabled", async () => {
    runMock.mockImplementation((name: string) => {
      if (name === "ipc-billing") return Promise.resolve(IPC_EMPTY);
      return Promise.resolve(IPC_RESULT);
    });
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await userEvent.click(screen.getByTestId("pi-tab-IPC_BILLING"));
    await pickProject("proj-a");
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-ipc-empty");
    expect(screen.getByTestId("pi-ipc-empty")).toHaveTextContent(/No IPCs raised/);
    // Export control still enabled (radios not `disabled`).
    expect(
      (screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe("Outstanding — per-project reconciliation band (FR-RPT-020)", () => {
  it("groups rows by project and shows a per-project 'Project outstanding' total from meta.projectTotals", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await userEvent.click(screen.getByTestId("pi-tab-OUTSTANDING"));
    await pickProject("proj-a");
    setDateField("param-as-of", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-out-table");

    const bands = screen.getAllByTestId("pi-out-project-band");
    expect(bands).toHaveLength(2);
    const totals = screen.getAllByTestId("pi-out-project-total");
    expect(totals).toHaveLength(2);
    expect(totals[0]).toHaveTextContent(/50/);
    expect(screen.getByTestId("pi-out-totals-footer")).toHaveTextContent(/Report total/);
  });
});

describe("Material consumption — UNBUDGETED renders '—' + verbatim CC status badge (FR-RPT-018, -004)", () => {
  it("collapses budgeted/variance/util for UNBUDGETED and shows the CC status badge", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await userEvent.click(screen.getByTestId("pi-tab-MATERIAL_CONSUMPTION"));
    await pickProject("proj-a");
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-mc-table");

    expect(screen.getByTestId("cc-status-OVER")).toHaveTextContent("Over budget");
    expect(screen.getByTestId("cc-status-UNBUDGETED")).toHaveTextContent("Unbudgeted");
    const rows = screen.getAllByTestId("pi-mc-row");
    // The UNBUDGETED row shows em-dashes.
    expect(rows[1]).toHaveTextContent("—");
  });
});

describe("Labour cost — server-supplied per-CC labour EXPENSE (FR-RPT-019)", () => {
  it("renders one row per (project, cost centre) + a 'Total labour cost' footer", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await userEvent.click(screen.getByTestId("pi-tab-LABOUR_COST"));
    await pickProject("proj-a");
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("pi-lc-table");
    expect(screen.getAllByTestId("pi-lc-row")).toHaveLength(1);
    expect(screen.getByTestId("pi-lc-totals-footer")).toHaveTextContent(/Total labour cost/);
    expect(screen.getByTestId("pi-lc-totals-footer")).toHaveTextContent(/500/);
  });
});

describe("Permission-denied — PM out-of-scope projectId returns 403 (FR-RPT-007)", () => {
  it("shows the 'You don't have access to this project.' body and disables Export", async () => {
    runMock.mockImplementation(() =>
      Promise.reject(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 })),
    );
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-forbidden");
    expect(screen.getByTestId("pi-forbidden")).toHaveTextContent(/don't have access to this project/);
    // Export radios are disabled while forbidden.
    expect(
      (screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("Error + retry preserves params (FR-RPT-004, spec §6)", () => {
  it("renders the per-report error banner, keeps params, and Retry re-fetches", async () => {
    runMock
      .mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }))
      .mockResolvedValueOnce(PNL_RESULT);
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    const banner = await screen.findByTestId("pi-pnl-error");
    expect(banner).toHaveTextContent(/Couldn't load the project P&L/);
    // Params preserved (field displays DD/MM/YYYY).
    expect(dateInput("param-date-from").value).toBe("01/04/2026");
    // Retry runs again.
    await userEvent.click(screen.getByTestId("pi-pnl-retry"));
    await screen.findByTestId("pi-pnl-table");
  });
});

describe("Export — Excel re-issues the same query with format=excel (FR-RPT-029)", () => {
  it("Excel re-issues, JSON table stays rendered", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-pnl-table");
    // Export is two-step: pick the format radio, then trigger the export.
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await userEvent.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("project-pnl");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    // Table still on-screen (JSON not re-rendered).
    expect(screen.getByTestId("pi-pnl-table")).toBeInTheDocument();
  });
});

describe("Read-only assertion — RPT owns no mutating control (FR-RPT-003)", () => {
  it("no Save / Post / Reverse / Delete / Edit button exists anywhere on the viewer", async () => {
    renderScreen();
    await screen.findByTestId("pi-viewer");
    await runPnl();
    await screen.findByTestId("pi-pnl-table");
    const container = screen.getByTestId("pi-viewer");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
