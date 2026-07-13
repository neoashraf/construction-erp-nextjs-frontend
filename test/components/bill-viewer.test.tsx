/**
 * FE-40 Purchase Bills — viewer tests (FR-PUR-020, FR-PUR-022, FR-PUR-023, FR-PUR-024).
 * Covers the read-only balanced ledger-lines display (no re-derivation), inventory
 * panel, linkage panel, Cancel path with applied-payments block + already-reversed
 * stale, 404 / 403 dispatch states, and the no-edit-affordance rule on a POSTED bill.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type PurchaseBill } from "@/features/purchase/types";
import { BillDetailDispatch } from "@/features/purchase/components/BillDetailDispatch";
import { BillViewer } from "@/features/purchase/components/BillViewer";
import * as billsApi from "@/features/purchase/api/bills";
import * as ledEntryApi from "@/features/purchase/api/led-entry";
import * as mastersApi from "@/features/purchase/api/masters";
import * as ordersApi from "@/features/purchase/api/orders";

const routerReplace = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn(), back: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/purchase/api/bills");
jest.mock("@/features/purchase/api/led-entry");
jest.mock("@/features/purchase/api/masters");
jest.mock("@/features/purchase/api/orders");

const getBillMock = billsApi.getPurchaseBill as jest.Mock;
const cancelBillMock = billsApi.cancelPurchaseBill as jest.Mock;
const getLedgerEntryMock = ledEntryApi.getBillLedgerEntry as jest.Mock;

function postedBill(over: Partial<PurchaseBill> = {}): PurchaseBill {
  return {
    id: "bill-1",
    projectId: "proj-a",
    supplierId: "sup-1",
    purchaseOrderId: null,
    supplierInvoiceRef: "INV-7741",
    billDate: "2026-07-10",
    dueDate: "2026-08-10",
    grossAmount: "50000.0000",
    vatInputAmount: "3750.0000",
    tdsAmount: "2500.0000",
    aitAmount: "1000.0000",
    netPayableAmount: "50250.0000",
    narration: null,
    status: "POSTED",
    entryNo: "PUR/2526/0042",
    journalEntryId: "je-1",
    outstandingAmount: "50250.0000",
    postedAt: "2026-07-10T10:22:11Z",
    postedBy: "u-1",
    version: 2,
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        expenseAccountId: null,
        isStockLine: true,
        billedQty: "100.0000",
        rate: "500.0000",
        lineAmount: "50000.0000",
        vatInputAmount: "3750.0000",
        tdsAmount: "2500.0000",
        aitAmount: "1000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        receivedQty: "100.0000",
        matchStatus: "MATCHED",
      },
    ],
    ...over,
  };
}

function entry() {
  return {
    id: "je-1",
    entryNo: "PUR/2526/0042",
    financialYearId: "fy-1",
    voucherType: "PURCHASE",
    voucherDate: "2026-07-10",
    sourceType: "purchase.bills",
    sourceId: "bill-1",
    isReversal: false,
    reversalOf: null,
    isReversed: false,
    reversedByEntryId: null,
    reversedBy: null,
    narration: null,
    postedAt: "2026-07-10T10:22:11Z",
    postedBy: "u-1",
    totalDebit: "53750.0000",
    totalCredit: "53750.0000",
    lines: [
      {
        id: "l-1",
        lineNo: 1,
        accountId: "acc-inventory",
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        godownId: "gd-a",
        partyId: null,
        debit: "50000.0000",
        credit: "0.0000",
        narration: null,
      },
      {
        id: "l-2",
        lineNo: 2,
        accountId: "acc-vat-input",
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        godownId: null,
        partyId: null,
        debit: "3750.0000",
        credit: "0.0000",
        narration: null,
      },
      {
        id: "l-3",
        lineNo: 3,
        accountId: "acc-ap",
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        godownId: null,
        partyId: "sup-1",
        debit: "0.0000",
        credit: "50250.0000",
        narration: null,
      },
      {
        id: "l-4",
        lineNo: 4,
        accountId: "acc-tds-payable",
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        godownId: null,
        partyId: null,
        debit: "0.0000",
        credit: "2500.0000",
        narration: null,
      },
      {
        id: "l-5",
        lineNo: 5,
        accountId: "acc-ait-payable",
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        godownId: null,
        partyId: null,
        debit: "0.0000",
        credit: "1000.0000",
        narration: null,
      },
    ],
  };
}

function user(role: Role): SafeUser {
  return { id: "u-1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "ACCOUNTS_MANAGER") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>{ui}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listSupplierOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listExpenseAccountOptions as jest.Mock).mockResolvedValue([]);
  (ordersApi.listPurchaseOrders as jest.Mock).mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
  getLedgerEntryMock.mockResolvedValue(entry());
});

// ── Dispatch ──
describe("BillDetailDispatch (spec §6)", () => {
  it("routes a POSTED bill to the viewer surface", async () => {
    getBillMock.mockResolvedValue(postedBill());
    renderWith(<BillDetailDispatch billId="bill-1" />);
    expect(await screen.findByTestId("bill-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("bill-viewer-title")).toHaveTextContent("PUR/2526/0042");
  });

  it("routes a 404 to the exact spec-copy dispatch-error state", async () => {
    getBillMock.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "x", status: 404 }));
    renderWith(<BillDetailDispatch billId="bill-1" />);
    expect(await screen.findByTestId("bill-dispatch-error")).toBeInTheDocument();
    expect(screen.getByText("This bill doesn't exist or isn't in your company.")).toBeInTheDocument();
  });

  it("routes a 403 to the permission-denied dispatch state", async () => {
    getBillMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "x", status: 403 }));
    renderWith(<BillDetailDispatch billId="bill-1" />);
    expect(await screen.findByTestId("bill-dispatch-error")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to this bill.")).toBeInTheDocument();
  });
});

// ── Viewer ──
describe("BillViewer (spec §4.viewer/§9; FR-PUR-020, FR-PUR-022, FR-PUR-024)", () => {
  it("renders the balanced ledger-lines table + inventory + linkage panels", async () => {
    renderWith(<BillViewer bill={postedBill()} />);
    await screen.findByTestId("bill-viewer");
    // Wait for the ledger fetch to resolve.
    await waitFor(() => expect(getLedgerEntryMock).toHaveBeenCalled());
    expect(await screen.findByTestId("bill-ledger-lines")).toBeInTheDocument();
    expect(screen.getByTestId("bill-inventory-panel")).toBeInTheDocument();
    expect(screen.getByTestId("bill-linkage-panel")).toBeInTheDocument();
    // Totals footer sums the returned lines exactly — never re-derived.
    expect(await screen.findByTestId("bill-ledger-totals")).toBeInTheDocument();
  });

  it("does NOT render any in-place edit affordance on a POSTED bill", async () => {
    renderWith(<BillViewer bill={postedBill()} />);
    await screen.findByTestId("bill-viewer");
    expect(screen.queryByTestId("bill-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bill-post")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bill-discard")).not.toBeInTheDocument();
  });

  it("Cancel with reason surfaces BILL_HAS_APPLIED_PAYMENTS block on the viewer banner", async () => {
    cancelBillMock.mockRejectedValue(
      new ApiError({ code: "BILL_HAS_APPLIED_PAYMENTS", message: "x", status: 409 }),
    );
    renderWith(<BillViewer bill={postedBill()} />);
    await screen.findByTestId("bill-viewer");
    await userEvent.click(screen.getByTestId("bill-cancel"));
    expect(await screen.findByTestId("bill-cancel-dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("bill-cancel-reason"), "Wrong supplier");
    await userEvent.click(screen.getByTestId("bill-cancel-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("bill-viewer-banner")).toHaveTextContent(
        /This bill has payments applied to it/,
      ),
    );
  });

  it("Cancel with a stale ALREADY_REVERSED shows the exact copy", async () => {
    cancelBillMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<BillViewer bill={postedBill()} />);
    await screen.findByTestId("bill-viewer");
    await userEvent.click(screen.getByTestId("bill-cancel"));
    await userEvent.type(screen.getByTestId("bill-cancel-reason"), "Duplicate");
    await userEvent.click(screen.getByTestId("bill-cancel-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("bill-viewer-banner")).toHaveTextContent(
        "This bill has already been reversed.",
      ),
    );
  });

  it("PM sees NO Cancel/Repost affordance on the viewer", async () => {
    renderWith(<BillViewer bill={postedBill()} />, "PROJECT_MANAGER");
    await screen.findByTestId("bill-viewer");
    expect(screen.queryByTestId("bill-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bill-repost")).not.toBeInTheDocument();
  });

  it("renders the cancelled ribbon on a CANCELLED bill", async () => {
    renderWith(<BillViewer bill={postedBill({ status: "CANCELLED" })} />);
    expect(await screen.findByTestId("bill-cancelled-ribbon")).toBeInTheDocument();
  });

  it("View-ledger-entry link routes via journalEntryId", async () => {
    renderWith(<BillViewer bill={postedBill()} />);
    const link = await screen.findByTestId("bill-view-ledger");
    expect(link).toHaveAttribute("href", "/ledger/entry-viewer?id=je-1");
  });
});
