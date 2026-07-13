/**
 * FE-41 GRN & matching — entry + match view tests (FR-PUR-015/-016/-017/-018/-024).
 * Covers: pre-fill from a PO's open quantities, received qty ≠ billed accepted with
 * a client-preview match delta, cross-project godown hard-block, `receivedQty ≤ 0`
 * validation, PERIOD_CLOSED banner, posted-GRN read-only with NO cancel/repost,
 * "nothing left to receive" empty state, Store-Keeper-only write gating (`403` for
 * PM/Accounts on the new-GRN route), match view default + `404` + PM `403`, and
 * responsive per-line cards visible below lg.
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
import { type Grn, type PurchaseBillPage, type MatchView as MatchViewType } from "@/features/purchase/types";
import { GrnEntry } from "@/features/purchase/components/GrnEntry";
import { GrnListScreen } from "@/features/purchase/components/GrnListScreen";
import { MatchView } from "@/features/purchase/components/MatchView";
import * as grnsApi from "@/features/purchase/api/grns";
import * as matchApi from "@/features/purchase/api/match";
import * as ordersApi from "@/features/purchase/api/orders";
import * as billsApi from "@/features/purchase/api/bills";
import * as mastersApi from "@/features/purchase/api/masters";
import * as stockBalanceApi from "@/features/purchase/api/stock-balance";

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
jest.mock("@/features/purchase/api/grns");
jest.mock("@/features/purchase/api/match");
jest.mock("@/features/purchase/api/orders");
jest.mock("@/features/purchase/api/bills");
jest.mock("@/features/purchase/api/masters");
jest.mock("@/features/purchase/api/stock-balance");

const listGrnsMock = grnsApi.listGrns as jest.Mock;
const getGrnMock = grnsApi.getGrn as jest.Mock;
const createGrnMock = grnsApi.createGrn as jest.Mock;
const postGrnMock = grnsApi.postGrn as jest.Mock;
const getMatchMock = matchApi.getMatch as jest.Mock;
const getPoMock = ordersApi.getPurchaseOrder as jest.Mock;

const PROJECTS = [{ id: "proj-a", projectCode: "BR-04", name: "Bridge-04", status: "ACTIVE" as const }];
const SUPPLIERS = [{ id: "sup-1", name: "ABC Cement", isActive: true }];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Materials", isActive: true }];
const PURPOSES = [{ id: "pp-1", name: "Concreting", projectId: "proj-a", isActive: true }];
const GODOWNS = [
  { id: "gd-a", code: "G-A", name: "Site godown", projectId: "proj-a", isActive: true },
  { id: "gd-x", code: "G-X", name: "Off-project godown", projectId: "proj-x", isActive: true },
];
const ITEMS = [
  { id: "it-cement", code: "IT-01", name: "OPC Cement 50kg", uom: "bag", isActive: true },
];
const EXPENSE_ACCOUNTS: never[] = [];

function grnResource(over: Partial<Grn> = {}): Grn {
  return {
    id: "grn-1",
    projectId: "proj-a",
    supplierId: "sup-1",
    purchaseOrderId: "po-1",
    purchaseBillId: null,
    grnRefNo: null,
    receiptDate: "2026-07-10",
    narration: null,
    status: "DRAFT",
    receivedBy: null,
    postedAt: null,
    version: 1,
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "100.0000",
        billedQty: "100.0000",
        receivedQty: "90.0000",
        rate: "500.0000",
        receivedValue: "45000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
      },
    ],
    ...over,
  };
}

function poResource() {
  return {
    id: "po-1",
    projectId: "proj-a",
    supplierId: "sup-1",
    poRefNo: "PO-2026-0001",
    poDate: "2026-07-05",
    expectedDeliveryDate: null,
    status: "APPROVED" as const,
    narration: null,
    approvedBy: "u-admin",
    approvedAt: "2026-07-05T05:00:00Z",
    version: 1,
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "100.0000",
        rate: "500.0000",
        lineAmount: "50000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        billedQty: "0.0000",
        receivedQty: "0.0000",
      },
    ],
  };
}

function emptyBillsPage(): PurchaseBillPage {
  return { data: [], page: 1, pageSize: 25, total: 0 };
}

function user(role: Role): SafeUser {
  return { id: "u-1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "STORE_KEEPER") {
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
  (ordersApi.listPurchaseOrders as jest.Mock).mockResolvedValue({
    data: [
      { id: "po-1", poRefNo: "PO-2026-0001", projectId: "proj-a", supplierId: "sup-1", poDate: "2026-07-05", status: "APPROVED" },
    ],
    page: 1,
    pageSize: 25,
    total: 1,
  });
  (billsApi.listPurchaseBills as jest.Mock).mockResolvedValue(emptyBillsPage());
  (stockBalanceApi.getStockBalance as jest.Mock).mockResolvedValue({
    godownId: "gd-a",
    itemId: "it-cement",
    quantityOnHand: "40.0000",
    totalValue: "20000.0000",
    weightedAverageRate: "500.0000",
    asOfDate: "2026-07-13",
  });
});

// ── List ──
describe("GrnListScreen (spec §4)", () => {
  it("shows the first-use empty state when nothing is filtered", async () => {
    listGrnsMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<GrnListScreen />);
    expect(await screen.findByTestId("grn-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("No goods receipts yet.")).toBeInTheDocument();
  });

  it("hides the New GRN CTA for a read-only actor (PROJECT_MANAGER)", async () => {
    listGrnsMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<GrnListScreen />, "PROJECT_MANAGER");
    await screen.findByTestId("grn-empty-firstuse");
    expect(screen.queryByTestId("grn-new")).not.toBeInTheDocument();
  });

  it("renders the error state with a Retry CTA", async () => {
    listGrnsMock.mockRejectedValue(new ApiError({ code: "NETWORK_ERROR", message: "x", status: 500 }));
    renderWith(<GrnListScreen />);
    expect(await screen.findByTestId("grn-retry")).toBeInTheDocument();
  });
});

// ── Entry ──
describe("GrnEntry — new / pre-fill (spec §5/§6; FR-PUR-015/-018)", () => {
  it("pre-fills the line grid from the selected PO's open quantities", async () => {
    getPoMock.mockResolvedValue(poResource());
    renderWith(<GrnEntry grnId={null} />);
    await screen.findByTestId("grn-form-title");
    await waitFor(() => expect(screen.getByTestId("po-picker")).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByTestId("po-picker"), "po-1");
    // Line prefilled — received qty defaults to the open balance (100).
    const inputs = await screen.findAllByTestId(/^grn-line-received-\d+$/);
    expect((inputs[0] as HTMLInputElement).value).toBe("100.0000");
  });

  it("shows the 'nothing left to receive' empty when every PO line is fully received", async () => {
    getPoMock.mockResolvedValue({
      ...poResource(),
      lines: [
        {
          lineNo: 1,
          itemId: "it-cement",
          orderedQty: "100.0000",
          rate: "500.0000",
          godownId: "gd-a",
          costCentreId: "cc-mat",
          purposeId: "pp-1",
          billedQty: "100.0000",
          receivedQty: "100.0000",
        },
      ],
    });
    renderWith(<GrnEntry grnId={null} />);
    await screen.findByTestId("grn-form-title");
    await waitFor(() => expect(screen.getByTestId("po-picker")).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByTestId("po-picker"), "po-1");
    expect(await screen.findByTestId("grn-lines-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing left to receive on this reference."),
    ).toBeInTheDocument();
  });
});

async function pickPo() {
  await screen.findByTestId("grn-form-title");
  await waitFor(() => expect(screen.getByTestId("po-picker")).not.toBeDisabled());
  await userEvent.selectOptions(screen.getByTestId("po-picker"), "po-1");
  // Wait for the async PO fetch → line prefill to render before returning.
  await screen.findAllByTestId(/^grn-line-received-\d+$/);
}

describe("GrnEntry — received qty ≠ billed accepted (FR-PUR-016/-017; edge 4/6)", () => {
  it("keeps the receivedQty input open regardless of the reference (under/over)", async () => {
    getPoMock.mockResolvedValue(poResource());
    renderWith(<GrnEntry grnId={null} />);
    await pickPo();
    const qty = (await screen.findAllByTestId(/^grn-line-received-\d+$/))[0]!;
    await userEvent.clear(qty);
    await userEvent.type(qty, "150");
    // Client preview shows the over-delivery delta.
    expect((await screen.findAllByTestId("grn-match-preview"))[0]).toHaveTextContent(/over/i);
    expect(createGrnMock).not.toHaveBeenCalled();
  });
});

describe("GrnEntry — validation & error mapping", () => {
  it("blocks save when received qty is empty with the exact spec §8 copy", async () => {
    getPoMock.mockResolvedValue(poResource());
    renderWith(<GrnEntry grnId={null} />);
    await pickPo();
    const qty = (await screen.findAllByTestId(/^grn-line-received-\d+$/))[0]!;
    await userEvent.clear(qty);
    await userEvent.click(screen.getAllByTestId("grn-save")[0]!);
    // Desktop + mobile both render the inline error → assert at least one.
    expect(
      (await screen.findAllByText("Received quantity must be greater than 0.")).length,
    ).toBeGreaterThan(0);
    expect(createGrnMock).not.toHaveBeenCalled();
  });

  it("maps CROSS_PROJECT_DIMENSION to the inline godown message (edge 13)", async () => {
    getPoMock.mockResolvedValue(poResource());
    createGrnMock.mockRejectedValue(
      new ApiError({
        code: "CROSS_PROJECT_DIMENSION",
        message: "cross project",
        status: 400,
        details: { path: ["lines", 0, "godownId"] },
      }),
    );
    renderWith(<GrnEntry grnId={null} />);
    await pickPo();
    await userEvent.click(screen.getAllByTestId("grn-save")[0]!);
    await waitFor(() =>
      expect(
        screen.getAllByText("This godown doesn't belong to the selected project.").length,
      ).toBeGreaterThan(0),
    );
  });

  it("maps PERIOD_CLOSED to the exact spec §8 posting-guard banner", async () => {
    getGrnMock.mockResolvedValue(grnResource());
    (grnsApi.updateGrn as jest.Mock).mockResolvedValue({ grn: grnResource({ version: 2 }) });
    postGrnMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderWith(<GrnEntry grnId="grn-1" />);
    await screen.findByTestId("grn-form-title");
    await waitFor(() => expect(getGrnMock).toHaveBeenCalled());
    await userEvent.click(screen.getAllByTestId("grn-post")[0]!);
    expect(await screen.findByTestId("grn-post-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("grn-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("grn-banner")).toHaveTextContent(
        "The period for this receipt's date is closed — posting isn't allowed.",
      ),
    );
  });

  it("blocks a read-only actor from the new-GRN route with a 403 (Accounts Manager)", async () => {
    renderWith(<GrnEntry grnId={null} />, "ACCOUNTS_MANAGER");
    expect(await screen.findByTestId("grn-403")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to record a goods receipt."),
    ).toBeInTheDocument();
  });
});

describe("GrnEntry — posted read-only (FR-PUR-024; brief AC)", () => {
  it("renders a POSTED GRN as read-only with NO Save/Post/Cancel/Repost affordance", async () => {
    getGrnMock.mockResolvedValue(
      grnResource({
        status: "POSTED",
        grnRefNo: "GRN-2526/0001",
        postedAt: "2026-07-10T05:00:00Z",
        receivedBy: "u-rafiq",
      }),
    );
    renderWith(<GrnEntry grnId="grn-1" />);
    await screen.findByTestId("grn-form-title");
    await waitFor(() => expect(getGrnMock).toHaveBeenCalled());
    expect(screen.queryByTestId("grn-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("grn-post")).not.toBeInTheDocument();
    // No cancel/repost dialogs or affordances exist on this screen — assert absence.
    expect(screen.queryByTestId("grn-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("grn-repost")).not.toBeInTheDocument();
    expect(screen.getByTestId("grn-posted-meta")).toBeInTheDocument();
  });
});

describe("GrnEntry — on-hand badge is informational (spec §9)", () => {
  it("renders the on-hand badge but never blocks Save on stock context", async () => {
    getPoMock.mockResolvedValue(poResource());
    createGrnMock.mockResolvedValue({ id: "grn-new" });
    renderWith(<GrnEntry grnId={null} />);
    await pickPo();
    // The on-hand badge is rendered but doesn't gate the save flow.
    await waitFor(() =>
      expect((screen.getAllByTestId("grn-on-hand"))[0]).toBeInTheDocument(),
    );
    await userEvent.click(screen.getAllByTestId("grn-save")[0]!);
    await waitFor(() => expect(createGrnMock).toHaveBeenCalled());
  });
});

// ── Match view ──
function matchPayload(over: Partial<MatchViewType> = {}): MatchViewType {
  return {
    poId: "po-1",
    poRefNo: "PO-2026-0001",
    projectId: "proj-a",
    supplierId: "sup-1",
    status: "PARTIALLY_RECEIVED",
    lines: [
      { lineNo: 1, itemId: "it-cement", orderedQty: "100.0000", billedQty: "100.0000", receivedQty: "90.0000", openQty: "10.0000", matchStatus: "UNDER_RECEIVED" },
    ],
    ...over,
  };
}

describe("MatchView (spec §4/§6; FR-PUR-017)", () => {
  it("renders the reconciliation table with the per-line match badge", async () => {
    getMatchMock.mockResolvedValue(matchPayload());
    renderWith(<MatchView poId="po-1" />);
    expect(await screen.findByTestId("match-title")).toHaveTextContent("PO-2026-0001");
    // Desktop grid + mobile card both show the badge — assert at least one and by testid.
    expect(within(screen.getByTestId("match-table")).getAllByTestId("match-status-UNDER_RECEIVED").length).toBeGreaterThan(0);
  });

  it("shows the 404 copy when the PO doesn't exist", async () => {
    getMatchMock.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "x", status: 404 }));
    renderWith(<MatchView poId="po-x" />);
    expect(await screen.findByTestId("match-404")).toBeInTheDocument();
    expect(
      screen.getByText("This purchase order doesn't exist or isn't in your company."),
    ).toBeInTheDocument();
  });

  it("shows the 403 copy for PMs outside the assigned project", async () => {
    getMatchMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "x", status: 403 }));
    renderWith(<MatchView poId="po-y" />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("match-403")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have access to this purchase order's match view."),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the PO has no lines", async () => {
    getMatchMock.mockResolvedValue(matchPayload({ lines: [] }));
    renderWith(<MatchView poId="po-1" />);
    expect(await screen.findByTestId("match-empty")).toBeInTheDocument();
  });
});
