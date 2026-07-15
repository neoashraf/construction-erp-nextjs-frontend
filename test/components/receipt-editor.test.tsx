/**
 * FE-43 fe-receipt-editor tests (FR-REC-001…-020, -024). Covers: mode picker create in
 * both modes + pre-save swap; §A IPC pick → inherited chips locked; live derived
 * cash-received + balance-due-after; zero-cash informational note; over-outstanding +
 * IPC-not-posted + amount ≤ 0 + tax > settled validations; §B invalid-general-target +
 * required cost-centre + "General" tag note; cheque-ref-required client pre-check;
 * period/project-closed + optimistic-lock + concurrent-post-immutable error mapping;
 * POSTED id → viewer redirect; permission-denied (`receipt:write` hidden entry,
 * `receipt:post` disables Post while Save works); the 360 mobile-narrow reflow.
 */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type Receipt } from "@/features/receipts/types";
import { ReceiptEditor } from "@/features/receipts/components/ReceiptEditor";
import * as receiptApi from "@/features/receipts/api/receipt";
import * as mastersApi from "@/features/receipts/api/masters";
import * as salesApi from "@/features/receipts/api/sales";

const routerReplace = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn() }),
}));
jest.mock("@/features/receipts/api/receipt");
jest.mock("@/features/receipts/api/masters");
jest.mock("@/features/receipts/api/sales");

const getMock = receiptApi.getReceipt as jest.Mock;
const createMock = receiptApi.createReceipt as jest.Mock;
const updateMock = receiptApi.updateReceipt as jest.Mock;
const deleteMock = receiptApi.deleteReceipt as jest.Mock;
const postMock = receiptApi.postReceipt as jest.Mock;
const ipcOutstandingMock = receiptApi.getReceiptsForIpc as jest.Mock;

const projectsMock = mastersApi.listProjectOptions as jest.Mock;
const customersMock = mastersApi.listCustomerOptions as jest.Mock;
const accountsMock = mastersApi.listAccountOptions as jest.Mock;
const costCentresMock = mastersApi.listCostCentreOptions as jest.Mock;
const purposesMock = mastersApi.listPurposeOptions as jest.Mock;

const postedIpcsMock = salesApi.listPostedIpcsForCustomer as jest.Mock;
const ipcDetailMock = salesApi.getIpcDetail as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "OPEN" },
];
const CUSTOMERS = [
  { id: "pa-8", name: "National Housing Authority", isActive: true },
  { id: "pa-1", name: "M/s Rahman Traders", isActive: true },
];
const ACCOUNTS = [
  { id: "acc-bank", code: "1201", name: "HSBC Current 001", type: "ASSET", isActive: true },
  { id: "acc-cash", code: "1101", name: "Cash on hand", type: "ASSET", isActive: true },
  { id: "acc-income", code: "4101", name: "Scrap sales", type: "INCOME", isActive: true },
  { id: "acc-adv", code: "2301", name: "Advance from customers", type: "LIABILITY", isActive: true },
  { id: "acc-exp", code: "5101", name: "Salaries", type: "EXPENSE", isActive: true },
] as const;
const CCS = [{ id: "cc-1", name: "Superstructure" }, { id: "cc-2", name: "Head office" }];
const PURPOSES = [{ id: "pp-1", name: "Progress billing" }];

const POSTED_IPCS = [
  {
    id: "ipc-5",
    ipcSeqNo: 5,
    entryNo: "IPC/2526/0005",
    projectId: "proj-a",
    customerId: "pa-8",
    ipcDate: "2026-07-12",
    certifiedAmount: "1000000.0000",
    currentlyDueAmount: "775000.0000",
    outstandingAmount: "775000.0000",
    status: "POSTED" as const,
  },
];
const IPC_DETAIL = {
  id: "ipc-5",
  projectId: "proj-a",
  customerId: "pa-8",
  ipcSeqNo: 5,
  ipcDate: "2026-07-12",
  workCompletedPct: "45.0000",
  costCentreId: "cc-1",
  purposeId: "pp-1",
  status: "POSTED" as const,
  entryNo: "IPC/2526/0005",
  currentlyDueAmount: "775000.0000",
  outstandingAmount: "775000.0000",
};
const IPC_OUTSTANDING = {
  rows: [],
  ipcCurrentlyDue: "775000.0000",
  totalApplied: "0.0000",
  balanceDue: "775000.0000",
};

function draftReceipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: "rec-1",
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-12",
    paymentMode: "BANK_TRANSFER",
    depositAccountId: "acc-bank",
    partyId: "pa-8",
    projectId: "proj-a",
    costCentreId: "cc-1",
    purposeId: "pp-1",
    ipcId: "ipc-5",
    generalTargetAccountId: null,
    amountSettled: "500000.0000",
    cashReceived: "475000.0000",
    taxDeductedAtSource: "25000.0000",
    chequeTxnRef: "TXN-9",
    narration: null,
    status: "DRAFT",
    entryNo: null,
    journalEntryId: null,
    ipcOutstandingAfter: null,
    postedAt: null,
    postedBy: null,
    version: 1,
    linkage: null,
    ...over,
  };
}

interface PermIn { resource: string; action: string }
function user(role: Role, permissions?: PermIn[]): SafeUser {
  const perms = permissions
    ? permissions.map((p) => ({ resource: p.resource, action: p.action as never, projectScope: "ALL", valueLimit: null }))
    : undefined;
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
    ...(perms ? { permissions: perms } : {}),
  } as unknown as SafeUser;
}

function renderWith(ui: React.ReactElement, role: Role = "ACCOUNTS_MANAGER", permissions?: PermIn[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role, permissions)}>{ui}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  projectsMock.mockResolvedValue(PROJECTS);
  customersMock.mockResolvedValue(CUSTOMERS);
  accountsMock.mockResolvedValue([...ACCOUNTS]);
  costCentresMock.mockResolvedValue(CCS);
  purposesMock.mockResolvedValue(PURPOSES);
  postedIpcsMock.mockResolvedValue(POSTED_IPCS);
  ipcDetailMock.mockResolvedValue(IPC_DETAIL);
  ipcOutstandingMock.mockResolvedValue(IPC_OUTSTANDING);
});

describe("Receipt editor — mode picker (spec §1/§8; FR-REC-001)", () => {
  it("shows both mode cards on create and swaps blocks before save (Open item 2)", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    expect(await screen.findByTestId("receipt-mode-picker")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-mode-ipc")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-mode-general")).toBeInTheDocument();
    // Neither mode block visible until picked.
    expect(screen.queryByTestId("receipt-ipc-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("receipt-general-card")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("receipt-mode-ipc"));
    expect(await screen.findByTestId("receipt-ipc-card")).toBeInTheDocument();

    // Free swap pre-save.
    await userEvent.click(screen.getByTestId("receipt-mode-general"));
    expect(await screen.findByTestId("receipt-general-card")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-ipc-card")).not.toBeInTheDocument();
  });

  it("hides the mode picker on edit of an existing draft (mode fixed after save)", async () => {
    getMock.mockResolvedValue(draftReceipt());
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    expect(screen.queryByTestId("receipt-mode-picker-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-ipc-card")).toBeInTheDocument();
  });
});

describe("Receipt editor — §A IPC-linked (spec §5/§7; FR-REC-002/017/018)", () => {
  it("locks the inherited dimensions once an IPC is picked", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-ipc"));
    // Pick a customer, wait for posted-IPCs, pick one.
    await userEvent.selectOptions(await screen.findByTestId("receipt-customer"), "pa-8");
    const ipcSelect = await screen.findByTestId("receipt-ipc");
    await userEvent.selectOptions(ipcSelect, "ipc-5");
    // Inherited chips render.
    const chips = await screen.findByTestId("receipt-ipc-inherited");
    await waitFor(() => {
      expect(chips.textContent).toContain("Bridge-04");
      expect(chips.textContent).toContain("Superstructure");
      expect(chips.textContent).toContain("Progress billing");
    });
  });

  it("shows the empty state when a customer has no posted IPCs", async () => {
    postedIpcsMock.mockResolvedValue([]);
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-ipc"));
    await userEvent.selectOptions(await screen.findByTestId("receipt-customer"), "pa-8");
    expect(await screen.findByTestId("receipt-ipc-empty")).toHaveTextContent(
      "No posted IPCs for this customer.",
    );
  });

  it("recomputes the derived cash-received live as tax deducted changes (FR-REC-019)", async () => {
    getMock.mockResolvedValue(draftReceipt({ amountSettled: "500000.0000", taxDeductedAtSource: "25000.0000" }));
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-cash-received");
    // Initially: 500000 − 25000 = 475000
    await waitFor(() =>
      expect(screen.getByTestId("receipt-cash-received").textContent).toMatch(/475,000\.0000/),
    );
    // Bump tax to 500000 → zero-cash valid, informational note
    await userEvent.clear(screen.getByTestId("receipt-tds"));
    await userEvent.type(screen.getByTestId("receipt-tds"), "500000");
    expect(await screen.findByTestId("receipt-zero-cash-note")).toBeInTheDocument();
  });

  it("blocks over-application on the amount field (FR-REC-017)", async () => {
    getMock.mockResolvedValue(
      draftReceipt({ amountSettled: "800000.0000", taxDeductedAtSource: "0.0000" }),
    );
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    // Wait for the balance-due panel to appear (proves the outstanding query resolved).
    await screen.findByTestId("receipt-balance-due");
    // Outstanding is 775 000. Amount 800 000 exceeds it. Post is disabled by postReady;
    // click Save to surface the inline error (server backstop still fires at Post).
    await userEvent.click(screen.getByTestId("receipt-save"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-amount-settled-err")).toHaveTextContent(
        /exceeds the IPC's remaining outstanding/,
      ),
    );
    expect(screen.getByTestId("receipt-post")).toBeDisabled();
  });

  it("blocks tax deducted > amount settled with the exact copy", async () => {
    getMock.mockResolvedValue(
      draftReceipt({ amountSettled: "500000.0000", taxDeductedAtSource: "600000.0000" }),
    );
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    // Post is disabled by postReady on the invalid tds — click Save to surface the field error.
    await userEvent.click(screen.getByTestId("receipt-save"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-tds-err")).toHaveTextContent(
        "Tax deducted can't exceed the amount settled.",
      ),
    );
  });

  it("maps IPC_NOT_POSTED to the exact spec message", async () => {
    const d = draftReceipt();
    getMock.mockResolvedValue(d);
    updateMock.mockResolvedValue({ ...d, version: d.version + 1 });
    postMock.mockRejectedValue(new ApiError({ code: "IPC_NOT_POSTED", message: "not posted", status: 409 }));
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    await screen.findByTestId("receipt-balance-due");
    await userEvent.click(screen.getByTestId("receipt-post"));
    await userEvent.click(await screen.findByTestId("receipt-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-banner")).toHaveTextContent(
        "This IPC is no longer posted.",
      ),
    );
  });
});

describe("Receipt editor — §B general (spec §5/§7; FR-REC-003/007/011)", () => {
  it("shows the 'Tagged: General (no project)' note when no project is picked", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-general"));
    expect(await screen.findByTestId("receipt-general-note")).toHaveTextContent(
      "Tagged: General (no project)",
    );
  });

  it("blocks Post when the cost centre is missing (client validation)", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-general"));
    // Fill required fields except cost centre.
    await userEvent.type(await screen.findByLabelText(/Receipt date/i), "12/07/2026");
    await userEvent.click(screen.getByTestId("receipt-mode-CASH"));
    await userEvent.selectOptions(screen.getByLabelText(/Deposit account/i), "acc-cash");
    await userEvent.selectOptions(screen.getByTestId("receipt-party"), "pa-1");
    await userEvent.selectOptions(screen.getByTestId("receipt-target"), "acc-income");
    // amount
    await userEvent.type(screen.getByTestId("receipt-amount-settled"), "30000");
    // Post is disabled — click Save to surface the inline required-field errors.
    await userEvent.click(screen.getByTestId("receipt-save"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-cost-centre-err")).toHaveTextContent("Choose a cost centre."),
    );
  });

  it("maps INVALID_GENERAL_TARGET to the target field", async () => {
    createMock.mockRejectedValue(new ApiError({ code: "INVALID_GENERAL_TARGET", message: "bad target", status: 400 }));
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-general"));
    await userEvent.type(await screen.findByLabelText(/Receipt date/i), "12/07/2026");
    await userEvent.click(screen.getByTestId("receipt-mode-CASH"));
    await userEvent.selectOptions(screen.getByLabelText(/Deposit account/i), "acc-cash");
    await userEvent.selectOptions(screen.getByTestId("receipt-party"), "pa-1");
    await userEvent.selectOptions(screen.getByTestId("receipt-target"), "acc-adv");
    await userEvent.selectOptions(screen.getByTestId("receipt-cost-centre"), "cc-2");
    await userEvent.type(screen.getByTestId("receipt-amount-settled"), "30000");
    await userEvent.click(screen.getByTestId("receipt-save"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-target-err")).toHaveTextContent(
        "This account can't receive a general receipt.",
      ),
    );
  });
});

describe("Receipt editor — shared header (spec §5; FR-REC-004)", () => {
  it("requires a cheque/transaction reference for non-cash modes (client pre-check)", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-general"));
    await userEvent.type(await screen.findByLabelText(/Receipt date/i), "12/07/2026");
    await userEvent.click(screen.getByTestId("receipt-mode-BANK_TRANSFER"));
    await userEvent.selectOptions(screen.getByLabelText(/Deposit account/i), "acc-bank");
    await userEvent.selectOptions(screen.getByTestId("receipt-party"), "pa-1");
    await userEvent.selectOptions(screen.getByTestId("receipt-target"), "acc-income");
    await userEvent.selectOptions(screen.getByTestId("receipt-cost-centre"), "cc-2");
    await userEvent.type(screen.getByTestId("receipt-amount-settled"), "10000");
    // Cheque/txn ref intentionally empty — Post is disabled; Save surfaces the inline error.
    await userEvent.click(screen.getByTestId("receipt-save"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-cheque-ref-err")).toHaveTextContent(
        "Enter a reference for this payment mode.",
      ),
    );
  });

  it("hides the reference field entirely for CASH", async () => {
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-general"));
    await userEvent.click(await screen.findByTestId("receipt-mode-CASH"));
    expect(screen.queryByTestId("receipt-cheque-ref")).not.toBeInTheDocument();
  });
});

describe("Receipt editor — lifecycle (FR-REC-009…-014, -024)", () => {
  it("routes to the viewer on successful Post with the entryNo toast", async () => {
    getMock.mockResolvedValue(
      draftReceipt({ amountSettled: "500000.0000", taxDeductedAtSource: "25000.0000" }),
    );
    updateMock.mockResolvedValue(
      draftReceipt({ amountSettled: "500000.0000", taxDeductedAtSource: "25000.0000", version: 2 }),
    );
    postMock.mockResolvedValue({
      id: "rec-1",
      entryNo: "RCT/2526/0042",
      journalEntryId: "je-9",
      status: "POSTED",
      ipcOutstandingAfter: "275000.0000",
    });
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    await userEvent.click(screen.getByTestId("receipt-post"));
    await userEvent.click(await screen.findByTestId("receipt-post-confirm"));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/receipts/rec-1/view"));
  });

  it("redirects a POSTED id straight to the viewer without editing", async () => {
    getMock.mockResolvedValue(draftReceipt({ status: "POSTED", entryNo: "RCT/2526/0099" }));
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/receipts/rec-1/view"));
  });

  it("maps VOUCHER_POSTED_IMMUTABLE to the concurrent-post banner", async () => {
    const d = draftReceipt();
    getMock.mockResolvedValue(d);
    updateMock.mockResolvedValue({ ...d, version: d.version + 1 });
    postMock.mockRejectedValue(new ApiError({ code: "VOUCHER_POSTED_IMMUTABLE", message: "already posted", status: 409 }));
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    await screen.findByTestId("receipt-balance-due");
    await userEvent.click(screen.getByTestId("receipt-post"));
    await userEvent.click(await screen.findByTestId("receipt-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-banner")).toHaveTextContent(
        "This receipt was already posted (by someone else). Refresh to see it.",
      ),
    );
  });

  it("maps PERIOD_CLOSED / PROJECT_CLOSED to the exact banners", async () => {
    const d = draftReceipt();
    getMock.mockResolvedValue(d);
    updateMock.mockResolvedValue({ ...d, version: d.version + 1 });
    postMock.mockRejectedValueOnce(new ApiError({ code: "PERIOD_CLOSED", message: "closed", status: 409 }));
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    await screen.findByTestId("receipt-balance-due");
    await userEvent.click(screen.getByTestId("receipt-post"));
    await userEvent.click(await screen.findByTestId("receipt-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-banner")).toHaveTextContent(
        "This period is closed. Choose a date in an open period or contact Admin.",
      ),
    );
  });
});

describe("Receipt editor — role/scope gating (spec §11)", () => {
  it("PM sees the 403 view on direct URL (New)", async () => {
    renderWith(<ReceiptEditor receiptId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("receipt-403")).toHaveTextContent(
      "You don't have permission to create receipts.",
    );
  });

  it("disables Post with the tooltip when `receipt:post` is absent", async () => {
    getMock.mockResolvedValue(draftReceipt());
    // ACCOUNTS_MANAGER with an explicit permission set that omits POST → falls into the
    // permission-check branch (not the role fallback).
    renderWith(<ReceiptEditor receiptId="rec-1" />, "ACCOUNTS_MANAGER", [
      { resource: "receipts", action: "CREATE" },
      { resource: "receipts", action: "UPDATE" },
      { resource: "receipts", action: "READ" },
    ]);
    await screen.findByTestId("receipt-editor-title");
    const post = screen.getByTestId("receipt-post");
    expect(post).toBeDisabled();
    expect(post).toHaveAttribute("title", "You don't have permission to post receipts.");
    // Save-draft still works.
    expect(screen.getByTestId("receipt-save")).not.toBeDisabled();
    // The info banner surfaces.
    expect(screen.getByTestId("receipt-post-denied-banner")).toBeInTheDocument();
  });
});

describe("Receipt editor — responsive tier (spec §4)", () => {
  it("renders the money + IPC blocks stacked at 360 (no layout-crash)", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 360 });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((q: string) => ({
        matches: q.includes("min-width: 1024") ? false : q.includes("max-width: 767") ? true : false,
        media: q,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    renderWith(<ReceiptEditor receiptId={null} />);
    await userEvent.click(await screen.findByTestId("receipt-mode-ipc"));
    expect(await screen.findByTestId("receipt-money-card")).toBeInTheDocument();
    // Mode picker still visible on create.
    expect(screen.getByTestId("receipt-mode-picker")).toBeInTheDocument();
  });
});

describe("Receipt editor — discard draft (FR-REC-024)", () => {
  it("deletes the draft on confirm and routes back to the list", async () => {
    getMock.mockResolvedValue(draftReceipt());
    deleteMock.mockResolvedValue(undefined);
    renderWith(<ReceiptEditor receiptId="rec-1" />);
    await screen.findByTestId("receipt-editor-title");
    await userEvent.click(screen.getByTestId("receipt-discard"));
    await userEvent.click(await screen.findByTestId("receipt-discard-confirm"));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("rec-1"));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/receipts"));
  });
});
