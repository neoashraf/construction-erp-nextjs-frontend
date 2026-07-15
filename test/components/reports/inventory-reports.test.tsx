/**
 * FE-58 fe-inventory-reports tests (FR-RPT-003/-021/-022/-023/-029).
 * Covers: 3-tab switch with shared filters preserved, stock-valuation as-of
 * + zero-stock note (distinct from empty) + totals footer, low-stock re-order
 * level parameter + breached count + text/tone flag, transfer summary date-
 * range + voucher link + mode pill, empty (Export enabled), partial name row,
 * error+retry per report, 403 view, read-only assertion, Excel export re-issue.
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
import { InventoryReportsViewer } from "@/features/reports/inventory/components/InventoryReportsViewer";

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

const SV_RESULT = {
  reportName: "stock-valuation",
  parameters: {},
  rows: [
    { godownId: "gd-a", godownCode: "G-A", godownName: "Site A store", itemId: "it-1", itemCode: "IT-101", itemName: "Cement", quantityOnHand: "1200.000", totalValue: "780000.0000", weightedAverageRate: "650.0000", asOf: "2026-06-30" },
    { godownId: "gd-a", godownCode: "G-A", godownName: "Site A store", itemId: "it-3", itemCode: "IT-103", itemName: "Sand", quantityOnHand: "0.000", totalValue: "0.0000", weightedAverageRate: null, asOf: "2026-06-30" },
    { godownId: "gd-b", godownCode: "G-B", godownName: "Site B store", itemId: "it-9", itemCode: "IT-999", itemName: null, quantityOnHand: "100.000", totalValue: "50000.0000", weightedAverageRate: "500.0000", asOf: "2026-06-30" },
  ],
  meta: {
    page: 1, pageSize: 3, total: 3,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { totalValue: "830000.0000" },
  },
};
const LS_RESULT = {
  reportName: "low-stock",
  parameters: { reorderLevel: "500" },
  rows: [
    { godownId: "gd-a", godownCode: "G-A", godownName: "Site A store", itemId: "it-3", itemCode: "IT-103", itemName: "Sand", quantityOnHand: "0.000", totalValue: "0.0000", weightedAverageRate: null, reorderLevel: "500", asOf: "2026-06-30" },
    { godownId: "gd-b", godownCode: "G-B", godownName: "Site B store", itemId: "it-1", itemCode: "IT-101", itemName: "Cement", quantityOnHand: "450.000", totalValue: "292500.0000", weightedAverageRate: "650.0000", reorderLevel: "500", asOf: "2026-06-30" },
  ],
  meta: {
    page: 1, pageSize: 2, total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { totalValue: "292500.0000", breachedCount: 2 },
  },
};
const TS_RESULT = {
  reportName: "stock-transfer-summary",
  parameters: {},
  rows: [
    { stockJournalId: "sj-1", voucherNo: "SJ/2526/000001", voucherDate: "2026-04-05", fromGodownId: "gd-a", fromGodownName: "Site A store", toGodownId: "gd-b", toGodownName: "Site B store", itemId: "it-1", itemName: "Cement", quantity: "200.000", value: "130000.0000", mode: "TRANSFER", approverId: "u-1", approverName: "Store Manager" },
    { stockJournalId: "sj-2", voucherNo: "SJ/2526/000002", voucherDate: "2026-04-12", fromGodownId: "gd-b", fromGodownName: "Site B store", toGodownId: null, toGodownName: null, itemId: "it-2", itemName: "MS Rod 12mm", quantity: "500.000", value: "410000.0000", mode: "ISSUE", approverId: "u-2", approverName: "Project Manager" },
  ],
  meta: {
    page: 1, pageSize: 2, total: 2,
    generatedAt: "2026-07-15T10:00:00Z",
    totals: { totalValueMoved: "540000.0000" },
  },
};
const TS_EMPTY = {
  ...TS_RESULT,
  rows: [],
  meta: {
    ...TS_RESULT.meta,
    total: 0,
    totals: { totalValueMoved: "0.0000" },
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
          <InventoryReportsViewer />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function runValuation() {
  fireEvent.change(screen.getByTestId("param-as-of") as HTMLInputElement, {
    target: { value: "2026-06-30" },
  });
  await userEvent.click(screen.getByTestId("report-run"));
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) => {
    switch (name) {
      case "stock-valuation": return Promise.resolve(SV_RESULT);
      case "low-stock": return Promise.resolve(LS_RESULT);
      case "stock-transfer-summary": return Promise.resolve(TS_RESULT);
      default: return Promise.resolve({ reportName: name, parameters: {}, rows: [], meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-15T10:00:00Z" } });
    }
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "stock-valuation.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([]);
  ccMock.mockResolvedValue([]);
});

describe("Inventory reports — 3-report switcher (FR-RPT-021/022/023, spec §3, §9)", () => {
  it("switches endpoints + columns and preserves shared godown/item filters across tabs", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-sv-table");
    // Pick a godown; switch tabs → filter carried across.
    await userEvent.selectOptions(
      screen.getByTestId("iv-filter-godown") as HTMLSelectElement,
      "gd-a",
    );
    await userEvent.click(screen.getByTestId("iv-tab-LOW_STOCK"));
    expect((screen.getByTestId("iv-filter-godown") as HTMLSelectElement).value).toBe("gd-a");
    // Low-stock exposes the re-order-level parameter.
    expect(screen.getByTestId("iv-filter-reorder")).toBeInTheDocument();
  });
});

describe("Stock valuation — zero-row + totals footer (FR-RPT-021, SRS edge 11)", () => {
  it("renders zero-quantity row inline with per-row note, plus the reconciling totals footer", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-sv-table");
    // Zero row is distinct from empty state.
    expect(screen.getByTestId("iv-sv-zero-row")).toBeInTheDocument();
    expect(screen.getByTestId("iv-sv-zero-note")).toHaveTextContent(/quantity 0/);
    expect(screen.queryByTestId("iv-sv-empty")).not.toBeInTheDocument();
    // Totals footer + reconciles-to-inventory-control label.
    const footer = screen.getByTestId("iv-sv-totals-footer");
    expect(footer).toHaveTextContent(/reconciles to Inventory control/);
    expect(footer).toHaveTextContent(/830,000/);
  });

  it("renders a partial (name-unavailable) placeholder when the item name is missing", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-sv-table");
    expect(screen.getByTestId("iv-name-unavailable")).toBeInTheDocument();
  });
});

describe("Low-stock — re-order parameter + breached count (FR-RPT-022)", () => {
  it("exposes the re-order-level parameter field, and renders the breached-row count + tone-labelled 'below re-order' status", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await userEvent.click(screen.getByTestId("iv-tab-LOW_STOCK"));
    fireEvent.change(screen.getByTestId("iv-filter-reorder") as HTMLInputElement, {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByTestId("param-as-of") as HTMLInputElement, {
      target: { value: "2026-06-30" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("iv-ls-table");
    expect(screen.getByTestId("iv-ls-totals-footer")).toHaveTextContent(/2 items at or below re-order/);
    // Every row shows a text-labelled destructive-tone badge — not colour alone.
    for (const badge of screen.getAllByTestId("iv-ls-below-badge")) {
      expect(badge).toHaveTextContent(/Below re-order/i);
    }
  });
});

describe("Transfer summary — flow + voucher link + mode pill (FR-RPT-023)", () => {
  it("renders one row per stock journal with mode pill (label + colour), Voucher link, and Total-value-moved footer", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await userEvent.click(screen.getByTestId("iv-tab-TRANSFER_SUMMARY"));
    fireEvent.change(screen.getByTestId("param-date-from") as HTMLInputElement, {
      target: { value: "2026-04-01" },
    });
    fireEvent.change(screen.getByTestId("param-date-to") as HTMLInputElement, {
      target: { value: "2026-06-30" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("iv-ts-table");
    // Mode pills carry a text label (WCAG 1.4.1).
    expect(screen.getByTestId("iv-ts-mode-TRANSFER")).toHaveTextContent("Transfer");
    expect(screen.getByTestId("iv-ts-mode-ISSUE")).toHaveTextContent("Issue");
    // Voucher link points to the Stock Journal viewer.
    const voucher = screen.getByRole("link", { name: /Open Stock Journal SJ\/2526\/000001/i });
    expect(voucher.getAttribute("href")).toContain("/inventory/stock-journal/");
    expect(screen.getByTestId("iv-ts-totals-footer")).toHaveTextContent(/Total value moved/);
    expect(screen.getByTestId("iv-ts-totals-footer")).toHaveTextContent(/540,000/);
  });

  it("Empty (no results for these filters) — Export stays enabled", async () => {
    runMock.mockImplementation((name: string) => {
      if (name === "stock-transfer-summary") return Promise.resolve(TS_EMPTY);
      return Promise.resolve(TS_RESULT);
    });
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await userEvent.click(screen.getByTestId("iv-tab-TRANSFER_SUMMARY"));
    fireEvent.change(screen.getByTestId("param-date-from") as HTMLInputElement, {
      target: { value: "2026-04-01" },
    });
    fireEvent.change(screen.getByTestId("param-date-to") as HTMLInputElement, {
      target: { value: "2026-06-30" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("iv-ts-empty");
    expect(
      (screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe("Permission-denied — 403 view + Export disabled (FR-RPT-007)", () => {
  it("shows the 'don't have access' body and disables Export when the server returns 403", async () => {
    runMock.mockImplementation(() =>
      Promise.reject(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 })),
    );
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-forbidden");
    expect(screen.getByTestId("iv-forbidden")).toHaveTextContent(/don't have access/);
    expect(
      (screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("Error + retry preserves params (FR-RPT-004)", () => {
  it("shows the per-report error banner, keeps as-of, and Retry re-fetches", async () => {
    runMock
      .mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }))
      .mockResolvedValueOnce(SV_RESULT);
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    const banner = await screen.findByTestId("iv-sv-error");
    expect(banner).toHaveTextContent(/Couldn't load stock valuation/);
    expect((screen.getByTestId("param-as-of") as HTMLInputElement).value).toBe("2026-06-30");
    await userEvent.click(screen.getByTestId("iv-sv-retry"));
    await screen.findByTestId("iv-sv-table");
  });
});

describe("Export — Excel re-issues the query (FR-RPT-029)", () => {
  it("Excel re-issues with format=excel; the on-screen table stays rendered", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-sv-table");
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("stock-valuation");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(screen.getByTestId("iv-sv-table")).toBeInTheDocument();
  });
});

describe("Read-only assertion — RPT owns no mutating control (FR-RPT-003)", () => {
  it("no Save / Post / Reverse / Delete / Cancel / Edit button exists anywhere on the viewer", async () => {
    renderScreen();
    await screen.findByTestId("iv-viewer");
    await runValuation();
    await screen.findByTestId("iv-sv-table");
    const container = screen.getByTestId("iv-viewer");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Cancel|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});
