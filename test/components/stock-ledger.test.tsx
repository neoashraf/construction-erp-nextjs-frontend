/**
 * FE-28 Stock Ledger tests (FR-INV-001/002/004/006/021). Balances rendering incl. the
 * null-weighted-average "—" state, the grouping toggle (client-side re-sort, no refetch),
 * the as-of-date filter, movement drill-through pre-fill + source-link routing per
 * sourceType, PM/Store Keeper scope (403), the no-write assertion, and the ≥360 prominent
 * quantity card.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type StockLedgerRow, type StockMovement } from "@/features/inventory/types";
import { StockLedgerScreen } from "@/features/inventory/components/StockLedgerScreen";
import * as ledgerApi from "@/features/inventory/api/stock-ledger";
import * as mastersApi from "@/features/inventory/api/masters";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/inventory/api/stock-ledger");
jest.mock("@/features/inventory/api/masters");

const listLedgerMock = ledgerApi.listStockLedger as jest.Mock;
const listMovementsMock = ledgerApi.listStockMovements as jest.Mock;

const GODOWNS = [
  { id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", isActive: true },
  { id: "gd-b", code: "G-Site-B", name: "Site B store", projectId: "proj-a", isActive: true },
];
const ITEMS = [
  { id: "it-cement", code: "IT-01", name: "Cement — 50kg bag", uom: "bag", isActive: true },
  { id: "it-rebar", code: "IT-02", name: "Rebar 12mm", uom: "ton", isActive: true },
];
const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04" }];

function bal(over: Partial<StockLedgerRow> = {}): StockLedgerRow {
  return {
    godownId: "gd-a",
    itemId: "it-cement",
    quantityOnHand: "1240.0000",
    totalValue: "672080.0000",
    weightedAverageRate: "542.0000",
    asOfDate: "2026-07-07",
    ...over,
  };
}

function mv(over: Partial<StockMovement> = {}): StockMovement {
  return {
    id: "mv-1",
    godownId: "gd-a",
    itemId: "it-cement",
    sourceType: "STOCK_JOURNAL",
    sourceId: "sj-4",
    direction: "OUT",
    quantity: "200.0000",
    rate: "540.0000",
    value: "108000.0000",
    balanceQtyAfter: "800.0000",
    balanceValueAfter: "432000.0000",
    avgRateAfter: "540.0000",
    isReversal: false,
    reversalOf: null,
    voucherDate: "2026-06-10",
    postedAt: "2026-06-10T06:30:00Z",
    ...over,
  };
}

function ledgerPage(rows: StockLedgerRow[]) {
  return { data: rows, page: 1, pageSize: 200, total: rows.length };
}
function movementPage(rows: StockMovement[]) {
  return { data: rows, page: 1, pageSize: 25, total: rows.length };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <StockLedgerScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue(GODOWNS);
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue(ITEMS);
  listMovementsMock.mockResolvedValue(movementPage([mv()]));
});

describe("StockLedgerScreen — balances (spec §4.A/§5)", () => {
  it("renders quantity/value per (godown, item) and '—' for a null weighted-average rate", async () => {
    listLedgerMock.mockResolvedValue(
      ledgerPage([
        bal({ godownId: "gd-a", itemId: "it-cement" }),
        bal({ godownId: "gd-b", itemId: "it-rebar", quantityOnHand: "0.0000", totalValue: "0.0000", weightedAverageRate: null }),
      ]),
    );
    renderScreen();
    await screen.findByTestId("sl-balances");
    // Value rendered with ৳; the zero-on-hand row shows a dash with the accessible reason, never ৳0.0000.
    expect(screen.getAllByText(/৳ 6,72,080.0000|৳ 672,080.0000/).length).toBeGreaterThan(0);
    // The zero-on-hand row shows a dash for the rate (with the accessible reason), never ৳0.0000.
    expect(screen.getAllByLabelText("No rate — nothing on hand.").length).toBeGreaterThan(0);
  });

  it("grouping toggle re-sorts the same payload without refetching (spec §5)", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([bal({ itemId: "it-cement" }), bal({ godownId: "gd-b", itemId: "it-cement" })]));
    renderScreen();
    await screen.findByTestId("sl-balances");
    expect(listLedgerMock).toHaveBeenCalledTimes(1);

    const byItem = screen.getByTestId("sl-group-item");
    expect(byItem).toHaveAttribute("aria-selected", "false");
    await userEvent.click(byItem);
    expect(byItem).toHaveAttribute("aria-selected", "true");
    // Still one fetch — grouping is a client-side re-render.
    expect(listLedgerMock).toHaveBeenCalledTimes(1);
  });

  it("as-of-date filter re-queries with YYYY-MM-DD (FR-INV-021)", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([bal()]));
    renderScreen();
    await screen.findByTestId("sl-balances");

    await userEvent.type(screen.getByPlaceholderText("Latest"), "15/06/2026");
    await waitFor(() =>
      expect(listLedgerMock).toHaveBeenCalledWith(expect.objectContaining({ asOfDate: "2026-06-15" })),
    );
  });

  it("shows the filtered empty state when filters match nothing", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([]));
    renderScreen();
    // Apply a godown filter so the empty is the filtered variant (wait for options to load).
    await screen.findByRole("option", { name: /G-Site-A/ });
    await userEvent.selectOptions(screen.getByTestId("sl-f-godown"), "gd-a");
    await userEvent.click(screen.getByTestId("sl-f-apply"));
    expect(await screen.findByTestId("sl-empty-filtered")).toBeInTheDocument();
    expect(screen.getByText("No stock balances match these filters.")).toBeInTheDocument();
  });

  it("shows the first-use empty state when nothing is filtered", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([]));
    renderScreen();
    expect(await screen.findByTestId("sl-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("No stock movements recorded yet for this project.")).toBeInTheDocument();
  });

  it("surfaces the assigned-project scope message on a 403 (spec §7)", async () => {
    listLedgerMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByTestId("sl-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You can only view your assigned projects.")).toBeInTheDocument();
  });

  it("renders the prominent quantity on the ≥360 card (spec §4.A)", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([bal({ quantityOnHand: "1240.0000" })]));
    renderScreen();
    await screen.findByTestId("sl-balances");
    const qty = screen.getAllByTestId("sl-card-qty")[0]!;
    expect(qty).toHaveTextContent("1,240.0000");
  });

  it("has no write affordance anywhere (FR-INV-004)", async () => {
    listLedgerMock.mockResolvedValue(ledgerPage([bal()]));
    renderScreen("STORE_KEEPER");
    await screen.findByTestId("sl-balances");
    expect(screen.queryByRole("button", { name: /new|create|edit|delete|post|reverse|save/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is written from this screen/i)).toBeInTheDocument();
  });
});

describe("StockLedgerScreen — movement history (spec §4.B/§6)", () => {
  async function openPanel() {
    listLedgerMock.mockResolvedValue(ledgerPage([bal({ godownId: "gd-a", itemId: "it-cement" })]));
    renderScreen();
    await screen.findByTestId("sl-balances");
    await userEvent.click(screen.getAllByTestId("sl-view")[0]!);
    return screen.findByTestId("sl-movement-panel");
  }

  it("drills through pre-filled with the row's (godown, item)", async () => {
    await openPanel();
    expect(screen.getByTestId("sl-movement-title")).toHaveTextContent(
      "Movement history — Cement — 50kg bag at G-Site-A — Site A store",
    );
    await waitFor(() =>
      expect(listMovementsMock).toHaveBeenCalledWith(
        expect.objectContaining({ godownId: "gd-a", itemId: "it-cement" }),
      ),
    );
  });

  it("routes each source badge to the correct voucher screen (FR-INV-006)", async () => {
    listMovementsMock.mockResolvedValue(
      movementPage([
        mv({ id: "m1", sourceType: "STOCK_JOURNAL", sourceId: "sj-4" }),
        mv({ id: "m2", sourceType: "GRN", sourceId: "grn-9" }),
        mv({ id: "m3", sourceType: "REQ_ISSUE", sourceId: "req-3" }),
      ]),
    );
    const panel = await openPanel();
    const p = within(panel);
    expect((await p.findAllByTestId("sl-source-STOCK_JOURNAL"))[0]).toHaveAttribute(
      "href",
      "/inventory/stock-journals/sj-4",
    );
    expect(p.getAllByTestId("sl-source-GRN")[0]).toHaveAttribute("href", "/purchase/bills/grn-9");
    expect(p.getAllByTestId("sl-source-REQ_ISSUE")[0]).toHaveAttribute("href", "/requisitions/issues/req-3");
  });

  it("shows a reversal as an additive badged row, original untouched (FR-INV-020)", async () => {
    listMovementsMock.mockResolvedValue(
      movementPage([mv({ id: "m1", isReversal: false }), mv({ id: "m2", isReversal: true, reversalOf: "m1" })]),
    );
    const panel = await openPanel();
    expect((await within(panel).findAllByTestId("sl-reversal-badge")).length).toBeGreaterThan(0);
  });

  it("shows the panel-specific empty state for a pair with no movements", async () => {
    listMovementsMock.mockResolvedValue(movementPage([]));
    const panel = await openPanel();
    expect(await within(panel).findByTestId("sl-mv-empty")).toBeInTheDocument();
    expect(within(panel).getByText("No movements recorded for this item at this godown.")).toBeInTheDocument();
  });

  it("keeps the balances table interactive when only the movement fetch fails (spec §6)", async () => {
    listMovementsMock.mockRejectedValue(new ApiError({ code: "UNKNOWN", message: "boom", status: 500 }));
    const panel = await openPanel();
    expect(await within(panel).findByTestId("sl-mv-retry")).toBeInTheDocument();
    // Balances behind the panel are still rendered.
    expect(screen.getByTestId("sl-balances")).toBeInTheDocument();
  });
});
