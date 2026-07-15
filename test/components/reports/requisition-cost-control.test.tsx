/**
 * FE-59 fe-requisition-cost-control-reports tests (FR-RPT-003/004/007/024/025/029).
 * Covers: tab switch + filter preservation, requested/issued/variance column
 * rendering (variance = REQ's derived value), CC variance status badges incl.
 * UNBUDGETED "—" cells, non-recomputation assertion (rendered values match
 * server exactly), 403 view, empty, partial, error+retry, read-only, Excel
 * export re-issue.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { RequisitionCostControlView } from "@/features/reports/rcc/components/RequisitionCostControlView";

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

const RVI_RESULT = {
  reportName: "requisition-vs-issue",
  parameters: {},
  rows: [
    { requisitionId: "req-1", requisitionNo: "RQ/2526/000001", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", itemId: "it-1", itemCode: "IT-101", itemName: "Cement", unit: "bag", requestedQty: "500.000", issuedQty: "500.000", varianceQty: "0.000" },
    { requisitionId: "req-1", requisitionNo: "RQ/2526/000001", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", itemId: "it-2", itemCode: "IT-102", itemName: "MS Rod 12mm", unit: "kg", requestedQty: "1000.000", issuedQty: "800.000", varianceQty: "200.000" },
    { requisitionId: "req-2", requisitionNo: "RQ/2526/000002", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-2", costCentreCode: "CC-02", costCentreName: "Labour", itemId: "it-3", itemCode: "IT-103", itemName: "Sand", unit: "cft", requestedQty: "200.000", issuedQty: "250.000", varianceQty: "-50.000" },
    { requisitionId: "req-3", requisitionNo: "RQ/2526/000003", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-x", costCentreCode: "CC-99", costCentreName: null, itemId: "it-4", itemCode: "IT-104", itemName: "Nails", unit: "kg", requestedQty: "100.000", issuedQty: "50.000", varianceQty: "50.000" },
  ],
  meta: {
    page: 1, pageSize: 4, total: 4,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { lineCount: 4, fullyIssued: 1, outstanding: 3 },
  },
};
const CCV_RESULT = {
  reportName: "cost-centre-variance",
  parameters: {},
  rows: [
    { projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", budgetedAmount: "1000.0000", actualCost: "1200.0000", variance: "-200.0000", utilisationPct: "120.0000", status: "OVER" },
    { projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-9", costCentreCode: "CC-09", costCentreName: "Overheads", budgetedAmount: null, actualCost: "500.0000", variance: null, utilisationPct: null, status: "UNBUDGETED" },
  ],
  meta: {
    page: 1, pageSize: 2, total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { budgeted: "1000.0000", actual: "1700.0000", variance: "-700.0000" },
  },
};
const CCV_EMPTY = {
  ...CCV_RESULT,
  rows: [],
  meta: { ...CCV_RESULT.meta, total: 0, totals: { budgeted: "0.0000", actual: "0.0000", variance: "0.0000" } },
};

function user(): SafeUser {
  return { id: "u1", email: "u@ze.test", name: "User", role: "ADMIN", companyId: "c1", financialYearId: "fy-1", isActive: true };
}
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <RequisitionCostControlView />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function waitForProjectOption(value: string) {
  await waitFor(() => {
    const sel = screen.getByTestId("param-project") as HTMLSelectElement;
    if (![...sel.options].some((o) => o.value === value)) throw new Error("no option yet");
  });
}
async function runReport(_tab: string) {
  await waitForProjectOption("proj-a");
  await userEvent.selectOptions(screen.getByTestId("param-project") as HTMLSelectElement, "proj-a");
  fireEvent.change(screen.getByTestId("param-date-from") as HTMLInputElement, { target: { value: "2026-04-01" } });
  fireEvent.change(screen.getByTestId("param-date-to") as HTMLInputElement, { target: { value: "2026-06-30" } });
  await userEvent.click(screen.getByTestId("report-run"));
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) => {
    if (name === "requisition-vs-issue") return Promise.resolve(RVI_RESULT);
    if (name === "cost-centre-variance") return Promise.resolve(CCV_RESULT);
    return Promise.resolve({ reportName: name, parameters: {}, rows: [], meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-15T10:00:00Z" } });
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "requisition-vs-issue.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([
    { id: "proj-a", label: "BR-04 · Bridge-04 — Buriganga" },
    { id: "proj-b", label: "TW-A · Tower-A — Gulshan" },
  ]);
  ccMock.mockResolvedValue([]);
});

describe("REQ + CC reports — switcher (FR-RPT-024/025, spec §3, §9)", () => {
  it("switches endpoints and preserves project across tabs", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-rvi-table");
    // Switch to CC variance.
    await userEvent.click(screen.getByTestId("rcc-tab-COST_CENTRE_VARIANCE"));
    // Project preserved.
    expect((screen.getByTestId("param-project") as HTMLSelectElement).value).toBe("proj-a");
    // Cost-centre-variance surfaces the status chips.
    expect(screen.getByTestId("rcc-ccv-filters")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("rcc-ccv-table");
    const called = runMock.mock.calls.map((c) => c[0]);
    expect(called).toEqual(expect.arrayContaining(["requisition-vs-issue", "cost-centre-variance"]));
  });
});

describe("Requisition vs issue — columns + variance dot (FR-RPT-024)", () => {
  it("renders requested/issued/variance for every line and a fulfilment summary", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-rvi-table");
    expect(screen.getAllByTestId("rcc-rvi-row")).toHaveLength(4);
    const variances = screen.getAllByTestId("rcc-rvi-variance").map((n) => n.textContent);
    expect(variances[0]).toMatch(/0\.000/);
    expect(variances[1]).toMatch(/200\.000/);
    expect(variances[2]).toMatch(/-50\.000/);
    // Summary band.
    expect(screen.getByTestId("rcc-rvi-summary")).toHaveTextContent(/Lines 4/);
    expect(screen.getByTestId("rcc-rvi-summary")).toHaveTextContent(/Fully issued 1/);
    // Requisition link points to REQ outstanding.
    const link = screen.getAllByRole("link", { name: /Open outstanding/ })[0]!;
    expect(link.getAttribute("href")).toContain("/requisitions/req-1/outstanding");
  });

  it("renders a partial (name-unavailable) placeholder for missing cost-centre name", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-rvi-table");
    expect(screen.getByTestId("rcc-name-unavailable")).toBeInTheDocument();
  });
});

describe("Cost-centre variance — verbatim CC classification (FR-RPT-025, FR-CC-010, FR-RPT-004)", () => {
  it("renders CC's status badge per row incl. UNBUDGETED with em-dashes; does not recompute variance/util", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await userEvent.click(screen.getByTestId("rcc-tab-COST_CENTRE_VARIANCE"));
    await runReport("COST_CENTRE_VARIANCE");
    await screen.findByTestId("rcc-ccv-table");

    expect(screen.getByTestId("rcc-status-OVER")).toHaveTextContent("Over budget");
    expect(screen.getByTestId("rcc-status-UNBUDGETED")).toHaveTextContent("Unbudgeted");

    // UNBUDGETED row shows budgeted/variance/util as "—" but keeps actual.
    const rows = screen.getAllByTestId("rcc-ccv-row");
    expect(rows[1]).toHaveTextContent("—");
    expect(rows[1]).toHaveTextContent(/500/);

    // Non-recomputation: the OVER row rendered values match server exactly
    // (1200 / 120% / -200) — no client re-round.
    expect(rows[0]).toHaveTextContent("120.0%");
    expect(rows[0]).toHaveTextContent(/-200/);
  });

  it("Empty results still show Export enabled", async () => {
    runMock.mockImplementation((name: string) => {
      if (name === "cost-centre-variance") return Promise.resolve(CCV_EMPTY);
      return Promise.resolve(RVI_RESULT);
    });
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await userEvent.click(screen.getByTestId("rcc-tab-COST_CENTRE_VARIANCE"));
    await runReport("COST_CENTRE_VARIANCE");
    await screen.findByTestId("rcc-ccv-empty");
    expect((screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Permission-denied — 403 view (FR-RPT-007)", () => {
  it("shows the 'don't have access' body and disables Export", async () => {
    runMock.mockImplementation(() =>
      Promise.reject(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 })),
    );
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-forbidden");
    expect(screen.getByTestId("rcc-forbidden")).toHaveTextContent(/don't have access/);
    expect((screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Error + retry preserves params (FR-RPT-004)", () => {
  it("shows the per-report error banner, keeps params, Retry re-runs", async () => {
    runMock
      .mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }))
      .mockResolvedValueOnce(RVI_RESULT);
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    const banner = await screen.findByTestId("rcc-rvi-error");
    expect(banner).toHaveTextContent(/Couldn't load requisition vs issue/);
    expect((screen.getByTestId("param-date-from") as HTMLInputElement).value).toBe("2026-04-01");
    await userEvent.click(screen.getByTestId("rcc-rvi-retry"));
    await screen.findByTestId("rcc-rvi-table");
  });
});

describe("Export — Excel re-issues (FR-RPT-029)", () => {
  it("Excel re-issues with format=excel; table stays rendered", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-rvi-table");
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("requisition-vs-issue");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(screen.getByTestId("rcc-rvi-table")).toBeInTheDocument();
  });
});

describe("Read-only assertion — no mutating control (FR-RPT-003)", () => {
  it("no Save/Post/Reverse/Delete/Cancel/Edit button anywhere on the viewer", async () => {
    renderScreen();
    await screen.findByTestId("rcc-viewer");
    await runReport("REQUISITION_VS_ISSUE");
    await screen.findByTestId("rcc-rvi-table");
    const container = screen.getByTestId("rcc-viewer");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Cancel|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
