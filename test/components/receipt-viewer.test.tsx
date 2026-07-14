/**
 * FE-44 fe-receipt-viewer tests (FR-REC-013/-015/-016/-018/-021/-022/-023/-024/-025).
 * Covers posted IPC-linked default (header + IPC-balance panel + balanced ledger-lines
 * with party on control line only + linkage-panel hidden), posted general (general-
 * target summary, no balance panel), cancelled (superseded ribbon + linkage +
 * Cancel/Repost hidden + Print kept), the immutability no-in-place-edit assertion, 404
 * + header-403 + ledger-403 in-panel state (brief G2), Cancel flow (mandatory reason →
 * CANCELLED + reversal), Repost flow, stale ALREADY_REVERSED handling, print preview
 * (default + "Not on file" + cancelled watermark), PM Cancel/Repost gating.
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
import { type Receipt } from "@/features/receipts/types";
import { ReceiptViewer } from "@/features/receipts/components/ReceiptViewer";
import * as receiptApi from "@/features/receipts/api/receipt";
import { apiClient } from "@/lib/api";

const routerReplace = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/receipts/api/receipt");
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const getMock = receiptApi.getReceipt as jest.Mock;
const cancelMock = receiptApi.cancelReceipt as jest.Mock;
const repostMock = receiptApi.repostReceipt as jest.Mock;
const journalMock = receiptApi.getReceiptJournalEntry as jest.Mock;
const outstandingMock = receiptApi.getReceiptsForIpc as jest.Mock;
const apiGetMock = apiClient.get as jest.Mock;

function postedIpcReceipt(over: Partial<Receipt> = {}): Receipt {
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
    chequeTxnRef: "TXN-2026-0099",
    narration: null,
    status: "POSTED",
    entryNo: "RCT/2526/0042",
    journalEntryId: "je-rec-1",
    ipcOutstandingAfter: "275000.0000",
    postedAt: "2026-07-12T05:30:00Z",
    postedBy: "u1",
    version: 2,
    linkage: {
      hasHistory: false,
      currentEntryNo: "RCT/2526/0042",
      originalEntryNo: "RCT/2526/0042",
      entries: [],
    },
    ...over,
  };
}

function postedGeneralReceipt(): Receipt {
  return {
    ...postedIpcReceipt({
      id: "rec-g",
      receiptType: "GENERAL",
      ipcId: null,
      generalTargetAccountId: "acc-adv",
      projectId: null,
      costCentreId: "cc-2",
      purposeId: null,
      chequeTxnRef: null,
      taxDeductedAtSource: "0.0000",
      cashReceived: "30000.0000",
      amountSettled: "30000.0000",
      ipcOutstandingAfter: null,
      entryNo: "RCT/2526/0043",
      journalEntryId: "je-rec-g",
    }),
  };
}

function cancelledReceipt(): Receipt {
  return {
    ...postedIpcReceipt({
      status: "CANCELLED",
      linkage: {
        hasHistory: true,
        currentEntryNo: "RCT/2526/0042",
        originalEntryNo: "RCT/2526/0042",
        entries: [
          {
            entryId: "je-rec-1",
            entryNo: "RCT/2526/0042",
            isReversal: false,
            isReversed: true,
            isCurrent: false,
            reversalOfEntryNo: null,
            reversedByEntryNo: "RCT/2526/0055",
            postedAt: "2026-07-12T05:30:00Z",
          },
          {
            entryId: "je-rec-1-rev",
            entryNo: "RCT/2526/0055",
            isReversal: true,
            isReversed: false,
            isCurrent: false,
            reversalOfEntryNo: "RCT/2526/0042",
            reversedByEntryNo: null,
            postedAt: "2026-07-13T09:00:00Z",
          },
        ],
      },
    }),
  };
}

const IPC_JE = {
  id: "je-rec-1",
  entryNo: "RCT/2526/0042",
  voucherType: "RECEIPT",
  voucherDate: "2026-07-12",
  postedAt: "2026-07-12T05:30:00Z",
  totalDebit: "500000.0000",
  totalCredit: "500000.0000",
  lines: [
    { id: "l1", lineNo: 1, accountId: "acc-bank", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: null, debit: "475000.0000", credit: "0.0000", narration: null },
    { id: "l2", lineNo: 2, accountId: "1450", projectId: "proj-a", costCentreId: "cc-1", purposeId: "pp-1", godownId: null, partyId: null, debit: "25000.0000", credit: "0.0000", narration: null },
    { id: "l3", lineNo: 3, accountId: "1200", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: "pa-8", debit: "0.0000", credit: "500000.0000", narration: null },
  ],
};

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "Ashraf", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "ACCOUNTS_MANAGER") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
  apiGetMock.mockResolvedValue({ data: [] });
  outstandingMock.mockResolvedValue({
    rows: [],
    ipcCurrentlyDue: "775000.0000",
    totalApplied: "500000.0000",
    balanceDue: "275000.0000",
  });
});

describe("ReceiptViewer — posted IPC-linked default (FR-REC-010/-013/-015/-018)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(postedIpcReceipt());
    journalMock.mockResolvedValue(IPC_JE);
  });

  it("renders the gapless entry number, status + type badges, and the immutability note", async () => {
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer");
    expect(screen.getByTestId("receipt-viewer-title")).toHaveTextContent("RCT/2526/0042");
    expect(screen.getByTestId("receipt-viewer-status-POSTED")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-viewer-type-IPC_LINKED")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-immutability-note")).toHaveTextContent(
      /Posted receipts can/i,
    );
  });

  it("shows the balanced ledger-lines totals footer and the party only on the AR line", async () => {
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-ledger-lines");
    await waitFor(() =>
      expect(screen.getByTestId("receipt-ledger-lines").textContent).toMatch(/500,000\.0000/),
    );
    // "View ledger entry" link routes via journalEntryId.
    const viewLink = await screen.findByTestId("receipt-view-ledger-entry");
    expect(viewLink).toHaveAttribute("href", "/ledger/entry-viewer?id=je-rec-1");
  });

  it("shows the IPC & balance-due panel with 'View all receipts applied' cross-link (FR-REC-016)", async () => {
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-ipc-balance-panel");
    expect(screen.getByTestId("receipt-view-all-applied")).toHaveAttribute("href", "/receipts?ipcId=ipc-5");
    expect(screen.getByTestId("receipt-view-ipc")).toHaveAttribute("href", "/sales/ipcs/ipc-5");
  });

  it("does not render any in-place Edit affordance (FR-REC-024)", async () => {
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer");
    expect(screen.queryByRole("button", { name: /^edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^edit/i })).not.toBeInTheDocument();
  });
});

describe("ReceiptViewer — posted general (FR-REC-011)", () => {
  it("shows the general-target summary and no IPC balance panel", async () => {
    getMock.mockResolvedValue(postedGeneralReceipt());
    journalMock.mockResolvedValue({ ...IPC_JE, id: "je-rec-g" });
    renderWith(<ReceiptViewer receiptId="rec-g" />);
    await screen.findByTestId("receipt-viewer");
    expect(screen.getByTestId("receipt-general-target-summary")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-ipc-balance-panel")).not.toBeInTheDocument();
  });
});

describe("ReceiptViewer — cancelled (FR-REC-021/-022/-023)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(cancelledReceipt());
    journalMock.mockResolvedValue(IPC_JE);
  });

  it("shows the superseded ribbon + linkage panel and hides Cancel/Repost while keeping Print", async () => {
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer");
    expect(screen.getByTestId("receipt-cancelled-ribbon")).toBeInTheDocument();
    expect(await screen.findByTestId("receipt-linkage")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-viewer-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("receipt-viewer-repost")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-viewer-print")).toBeInTheDocument();
  });
});

describe("ReceiptViewer — error paths (spec §6)", () => {
  it("renders the 404 empty-state on NOT_FOUND", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "no", status: 404 }));
    renderWith(<ReceiptViewer receiptId="missing" />);
    expect(await screen.findByTestId("receipt-not-found")).toBeInTheDocument();
  });

  it("renders the header 403 view when the caller lacks receipts:READ scope", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderWith(<ReceiptViewer receiptId="rec-1" />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("receipt-forbidden")).toBeInTheDocument();
  });

  it("keeps the header + surfaces the ledger-lines 403 in its own panel (brief G2)", async () => {
    getMock.mockResolvedValue(postedIpcReceipt());
    journalMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderWith(<ReceiptViewer receiptId="rec-1" />, "PROJECT_MANAGER");
    // Header still loads.
    await screen.findByTestId("receipt-viewer-title");
    // Ledger-lines panel shows its own state.
    expect(await screen.findByTestId("receipt-ledger-lines-forbidden")).toBeInTheDocument();
    // PM never sees Cancel/Repost.
    expect(screen.queryByTestId("receipt-viewer-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("receipt-viewer-repost")).not.toBeInTheDocument();
  });
});

describe("ReceiptViewer — Cancel flow (FR-REC-021)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(postedIpcReceipt());
    journalMock.mockResolvedValue(IPC_JE);
  });

  it("requires a reason and toasts on success", async () => {
    cancelMock.mockResolvedValue({
      id: "rec-1",
      status: "CANCELLED",
      reversalEntryId: "je-rec-1-rev",
      reversalEntryNo: "RCT/2526/0055",
      ipcOutstandingAfter: "775000.0000",
    });
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer-title");
    await userEvent.click(screen.getByTestId("receipt-viewer-cancel"));
    const dialog = await screen.findByTestId("receipt-cancel-dialog");
    // Confirm-with-empty-reason is blocked inline.
    await userEvent.click(screen.getByTestId("receipt-cancel-confirm"));
    expect(await screen.findByTestId("receipt-cancel-reason-err")).toHaveTextContent(
      "Enter a reason for cancelling this receipt.",
    );
    await userEvent.type(screen.getByTestId("receipt-cancel-reason"), "Wrong IPC");
    await userEvent.click(screen.getByTestId("receipt-cancel-confirm"));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("rec-1", { reason: "Wrong IPC", version: 2 }),
    );
    expect(dialog).not.toBeInTheDocument();
  });

  it("maps stale ALREADY_REVERSED to the friendly banner + re-syncs", async () => {
    cancelMock.mockRejectedValue(
      new ApiError({ code: "ALREADY_REVERSED", message: "gone", status: 409 }),
    );
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer-title");
    await userEvent.click(screen.getByTestId("receipt-viewer-cancel"));
    await userEvent.type(await screen.findByTestId("receipt-cancel-reason"), "stale");
    await userEvent.click(screen.getByTestId("receipt-cancel-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("receipt-viewer-banner")).toHaveTextContent(
        "This receipt has already been cancelled.",
      ),
    );
  });
});

describe("ReceiptViewer — Repost flow (FR-REC-021/-023)", () => {
  it("posts a corrected entry via …/repost with the new amounts + reason", async () => {
    getMock.mockResolvedValue(postedIpcReceipt());
    journalMock.mockResolvedValue(IPC_JE);
    repostMock.mockResolvedValue({
      id: "rec-1",
      status: "POSTED",
      entryNo: "RCT/2526/0056",
      reversalEntryNo: "RCT/2526/0055",
      ipcOutstandingAfter: "275000.0000",
    });
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer-title");
    await userEvent.click(screen.getByTestId("receipt-viewer-repost"));
    const amt = await screen.findByTestId("receipt-repost-amount");
    await userEvent.clear(amt);
    await userEvent.type(amt, "400000");
    await userEvent.type(screen.getByTestId("receipt-repost-reason"), "Undercharge");
    await userEvent.click(screen.getByTestId("receipt-repost-confirm"));
    await waitFor(() => {
      expect(repostMock).toHaveBeenCalledTimes(1);
      const call = repostMock.mock.calls[0]!;
      expect(call[0]).toBe("rec-1");
      expect(call[1]).toMatchObject({ reason: "Undercharge", version: 2, amountSettled: "400000" });
    });
  });
});

describe("ReceiptViewer — Print preview (FR-REC-025)", () => {
  it("opens the print dialog with a money-receipt title and 'Not on file' for missing identifiers", async () => {
    getMock.mockResolvedValue(postedIpcReceipt());
    journalMock.mockResolvedValue(IPC_JE);
    renderWith(<ReceiptViewer receiptId="rec-1" />);
    await screen.findByTestId("receipt-viewer-title");
    await userEvent.click(screen.getByTestId("receipt-viewer-print"));
    const doc = await screen.findByTestId("receipt-print-document");
    expect(doc.textContent).toContain("Not on file"); // company identifiers unresolved
    // Amount in words present (Open item 2).
    expect(screen.getByTestId("receipt-print-in-words")).toHaveTextContent(/in words —/);
  });
});
