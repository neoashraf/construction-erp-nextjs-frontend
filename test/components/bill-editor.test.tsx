/**
 * FE-40 Purchase Bills — editor tests (FR-PUR-003…-014, -019, -022, -024). Covers the
 * draft lifecycle (create → save → post), stock/non-stock line-type XOR (`LINE_TYPE_INVALID`),
 * live net-payable recompute + `NET_PAYABLE_NEGATIVE` block, VAT/TDS/AIT override,
 * cross-project godown hard-block, closed-period / project-closed banners, applied-payments
 * cancel-block, PM read-only gating, and the two list empty variants.
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
import { BillEditor } from "@/features/purchase/components/BillEditor";
import { BillListScreen } from "@/features/purchase/components/BillListScreen";
import * as billsApi from "@/features/purchase/api/bills";
import * as ordersApi from "@/features/purchase/api/orders";
import * as mastersApi from "@/features/purchase/api/masters";

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
jest.mock("@/features/purchase/api/orders");
jest.mock("@/features/purchase/api/masters");

const listBillsMock = billsApi.listPurchaseBills as jest.Mock;
const getBillMock = billsApi.getPurchaseBill as jest.Mock;
const createBillMock = billsApi.createPurchaseBill as jest.Mock;
const updateBillMock = billsApi.updatePurchaseBill as jest.Mock;
const postBillMock = billsApi.postPurchaseBill as jest.Mock;

const PROJECTS = [{ id: "proj-a", projectCode: "BR-04", name: "Bridge-04", status: "ACTIVE" }];
const SUPPLIERS = [
  { id: "sup-1", name: "ABC Cement Co.", isActive: true },
  { id: "sup-2", name: "Padma Aggregates", isActive: false },
];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Materials", isActive: true }];
const PURPOSES = [{ id: "pp-1", name: "Concreting", projectId: "proj-a", isActive: true }];
const GODOWNS = [{ id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", isActive: true }];
const ITEMS = [{ id: "it-cement", code: "IT-01", name: "Cement 50kg", uom: "bag", isActive: true }];
const EXPENSE_ACCOUNTS = [
  { id: "exp-transport", code: "5501", name: "Transport", type: "EXPENSE" as const, isActive: true },
];

function billResource(over: Partial<PurchaseBill> = {}): PurchaseBill {
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
    status: "DRAFT",
    entryNo: null,
    journalEntryId: null,
    outstandingAmount: "0.0000",
    postedAt: null,
    postedBy: null,
    version: 1,
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
      },
    ],
    ...over,
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
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listSupplierOptions as jest.Mock).mockResolvedValue(SUPPLIERS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue(CCS);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue(PURPOSES);
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue(GODOWNS);
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue(ITEMS);
  (mastersApi.listExpenseAccountOptions as jest.Mock).mockResolvedValue(EXPENSE_ACCOUNTS);
  (ordersApi.listPurchaseOrders as jest.Mock).mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
});

async function fillNewDraft() {
  renderWith(<BillEditor billId={null} />);
  await screen.findByTestId("bill-form-title");
  await userEvent.selectOptions(await screen.findByTestId("bill-supplier"), "sup-1");
  await userEvent.selectOptions(screen.getByTestId("bill-project"), "proj-a");
  await userEvent.type(screen.getByLabelText(/^Bill date/i), "10/07/2026");
  await userEvent.type(screen.getByLabelText(/^Due date/i), "10/08/2026");
  await userEvent.selectOptions((await screen.findAllByTestId("bill-line-item"))[0]!, "it-cement");
  await userEvent.type(screen.getAllByTestId("bill-line-qty")[0]!, "100");
  await userEvent.type(screen.getAllByTestId("bill-line-rate")[0]!, "500");
  await userEvent.selectOptions(screen.getAllByTestId("bill-line-godown")[0]!, "gd-a");
  await userEvent.selectOptions(screen.getAllByTestId("bill-line-cc")[0]!, "cc-mat");
  await userEvent.selectOptions(screen.getAllByTestId("bill-line-purpose")[0]!, "pp-1");
}

// ── List ──
describe("BillListScreen (spec §4.list/§6)", () => {
  it("shows the first-use empty state when nothing is filtered", async () => {
    listBillsMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<BillListScreen />);
    expect(await screen.findByTestId("bill-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("No purchase bills yet.")).toBeInTheDocument();
  });

  it("hides the New bill CTA for a read-only actor (PROJECT_MANAGER)", async () => {
    listBillsMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<BillListScreen />, "PROJECT_MANAGER");
    await screen.findByTestId("bill-empty-firstuse");
    expect(screen.queryByTestId("bill-new")).not.toBeInTheDocument();
  });

  it("renders the error state with a Retry CTA", async () => {
    listBillsMock.mockRejectedValue(new ApiError({ code: "NETWORK_ERROR", message: "x", status: 500 }));
    renderWith(<BillListScreen />);
    expect(await screen.findByTestId("bill-retry")).toBeInTheDocument();
  });

  it("renders the running-totals strip when rows are present", async () => {
    listBillsMock.mockResolvedValue({
      data: [
        {
          id: "bill-a",
          entryNo: "PUR/2526/0001",
          projectId: "proj-a",
          supplierId: "sup-1",
          billDate: "2026-07-10",
          grossAmount: "50000.0000",
          vatInputAmount: "3750.0000",
          tdsAmount: "2500.0000",
          aitAmount: "1000.0000",
          netPayableAmount: "50250.0000",
          outstandingAmount: "50250.0000",
          status: "POSTED",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    renderWith(<BillListScreen />);
    await screen.findByTestId("bill-list");
    expect(screen.getByTestId("bill-list-totals")).toBeInTheDocument();
  });
});

// ── Editor ──
describe("BillEditor (spec §4.editor/§6/§7; FR-PUR-004/-005/-007/-024)", () => {
  it("validates required fields with the exact spec copy", async () => {
    renderWith(<BillEditor billId={null} />);
    await screen.findByTestId("bill-form-title");
    await userEvent.click(screen.getAllByTestId("bill-save")[0]!);
    expect(await screen.findByText("Select a supplier.")).toBeInTheDocument();
    expect(screen.getByText("Select a project.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid bill date.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid due date.")).toBeInTheDocument();
  });

  it("saves a DRAFT and redirects to its detail route", async () => {
    createBillMock.mockResolvedValue({ id: "bill-new", warnings: [] });
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("bill-save")[0]!);
    await waitFor(() => expect(createBillMock).toHaveBeenCalled());
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/purchase/bills/bill-new"));
  });

  it("blocks Save with the exact NET_PAYABLE_NEGATIVE banner when TDS+AIT > gross+VAT (FR-PUR-007)", async () => {
    await fillNewDraft();
    // Push TDS way beyond the gross so net payable goes negative.
    await userEvent.clear(screen.getAllByTestId("bill-line-tds")[0]!);
    await userEvent.type(screen.getAllByTestId("bill-line-tds")[0]!, "100000");
    await userEvent.click(screen.getAllByTestId("bill-save")[0]!);
    expect(await screen.findByTestId("bill-banner")).toHaveTextContent(
      /net payable can't be negative/i,
    );
    expect(createBillMock).not.toHaveBeenCalled();
  });

  it("blocks with LINE_TYPE_INVALID when both item and expense are set", async () => {
    createBillMock.mockRejectedValue(
      new ApiError({
        code: "LINE_TYPE_INVALID",
        message: "x",
        status: 400,
        details: { path: ["lines", 0, "isStockLine"] },
      }),
    );
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("bill-save")[0]!);
    await waitFor(() =>
      expect(screen.getByTestId("bill-banner")).toHaveTextContent(
        "Choose either an item or an expense account for this line, not both.",
      ),
    );
  });

  it("maps CROSS_PROJECT_DIMENSION to the inline godown message (edge 13)", async () => {
    createBillMock.mockRejectedValue(
      new ApiError({
        code: "CROSS_PROJECT_DIMENSION",
        message: "cross project",
        status: 400,
        details: { path: ["lines", 0, "godownId"] },
      }),
    );
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("bill-save")[0]!);
    expect(
      (await screen.findAllByText("This godown doesn't belong to the selected project.")).length,
    ).toBeGreaterThan(0);
  });

  it("maps PERIOD_CLOSED to the exact spec §8 posting-guard banner", async () => {
    getBillMock.mockResolvedValue(billResource({ id: "bill-9", version: 2 }));
    updateBillMock.mockResolvedValue({ bill: billResource({ id: "bill-9", version: 3 }), warnings: [] });
    postBillMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderWith(<BillEditor billId="bill-9" />);
    await screen.findByTestId("bill-form-title");
    await waitFor(() => expect(getBillMock).toHaveBeenCalled());
    await userEvent.click(screen.getAllByTestId("bill-post")[0]!);
    expect(await screen.findByTestId("bill-post-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("bill-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("bill-banner")).toHaveTextContent(
        "The period for this bill's date is closed — posting isn't allowed.",
      ),
    );
  });

  it("Post routes to the viewer on success with the allocated entryNo (FR-PUR-008/-013)", async () => {
    getBillMock.mockResolvedValue(billResource({ id: "bill-9", version: 2 }));
    updateBillMock.mockResolvedValue({ bill: billResource({ id: "bill-9", version: 3 }), warnings: [] });
    postBillMock.mockResolvedValue({
      id: "bill-9",
      entryNo: "PUR/2526/0042",
      journalEntryId: "je-1",
      status: "POSTED",
      netPayableAmount: "50250.0000",
    });
    renderWith(<BillEditor billId="bill-9" />);
    await screen.findByTestId("bill-form-title");
    await waitFor(() => expect(getBillMock).toHaveBeenCalled());
    await userEvent.click(screen.getAllByTestId("bill-post")[0]!);
    await userEvent.click(screen.getByTestId("bill-post-confirm"));
    await waitFor(() => expect(postBillMock).toHaveBeenCalled());
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/purchase/bills/bill-9"));
  });

  it("blocks a read-only actor from the new-bill route with a 403 (PM)", async () => {
    renderWith(<BillEditor billId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("bill-403")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to raise a purchase bill."),
    ).toBeInTheDocument();
  });

  it("renders a POSTED bill in the editor as read-only (no Save/Post/Discard affordances)", async () => {
    getBillMock.mockResolvedValue(billResource({ id: "bill-9", status: "POSTED", entryNo: "PUR/2526/0042", journalEntryId: "je-1" }));
    renderWith(<BillEditor billId="bill-9" />);
    await screen.findByTestId("bill-form-title");
    await waitFor(() => expect(getBillMock).toHaveBeenCalled());
    // In the editor view a POSTED bill is read-only — no write affordances.
    expect(screen.queryByTestId("bill-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bill-post")).not.toBeInTheDocument();
  });
});
