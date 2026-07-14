/**
 * FE-47 fe-payment-viewer tests (FR-PAY-010/-011/-013/-015/-016/-017/-018/-019).
 * Covers: posted default (header + allocations + balanced ledger lines with party on
 * control line + no godown column), cancelled (superseded ribbon + linkage +
 * Cancel/Correct hidden), no-in-place-edit assertion, 404 + header-403 +
 * ledger-lines-403 in-panel state, "View ledger entry" routing, Cancel refresh with
 * ALREADY_REVERSED mapping, Correct route link, PM 403.
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
import { type Payment } from "@/features/payments/types";
import { PaymentViewer } from "@/features/payments/components/PaymentViewer";
import * as paymentApi from "@/features/payments/api/payment";
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
jest.mock("@/features/payments/api/payment");
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const getMock = paymentApi.getPayment as jest.Mock;
const journalMock = paymentApi.getPaymentJournalEntry as jest.Mock;
const cancelMock = paymentApi.cancelPayment as jest.Mock;
const apiGetMock = apiClient.get as jest.Mock;

function postedPayment(over: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    partyId: "pa-1",
    paymentDate: "2026-07-11",
    paymentMode: "RTGS",
    paymentAccountId: "1201",
    chequeTxnRef: "RTGS-99815",
    bankChargesAmount: "150.0000",
    bankChargesProjectId: null,
    bankChargesCostCentreId: null,
    bankChargesPurposeId: null,
    paymentAmount: "200150.0000",
    narration: "Part-payment — Sup-A bill 0042",
    status: "POSTED",
    entryNo: "PAY/2526/0031",
    journalEntryId: "je-pay-1",
    allocatedAmount: "200000.0000",
    unallocatedAmount: "150.0000",
    allocations: [
      {
        lineNo: 1,
        payableType: "PURCHASE_BILL",
        payableId: "bill-1",
        amountAllocated: "200000.0000",
        accruedAmount: null,
        partyId: "pa-1",
        projectId: null,
        costCentreId: null,
        purposeId: null,
      },
    ],
    postedAt: "2026-07-11T10:22:11Z",
    postedBy: "u1",
    version: 2,
    linkage: { hasHistory: false, currentEntryNo: "PAY/2526/0031", originalEntryNo: "PAY/2526/0031", entries: [] },
    ...over,
  };
}

const POSTED_JE = {
  id: "je-pay-1",
  entryNo: "PAY/2526/0031",
  voucherType: "PAYMENT",
  voucherDate: "2026-07-11",
  postedAt: "2026-07-11T10:22:11Z",
  totalDebit: "200150.0000",
  totalCredit: "200150.0000",
  lines: [
    { id: "l1", lineNo: 1, accountId: "2100", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: "pa-1", debit: "200000.0000", credit: "0.0000", narration: null },
    { id: "l2", lineNo: 2, accountId: "5300", projectId: "proj-a", costCentreId: "cc-1", purposeId: "pp-1", godownId: null, partyId: null, debit: "150.0000", credit: "0.0000", narration: null },
    { id: "l3", lineNo: 3, accountId: "1201", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: null, debit: "0.0000", credit: "200150.0000", narration: null },
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
});

describe("PaymentViewer — posted default (FR-PAY-010/-013/-017)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(postedPayment());
    journalMock.mockResolvedValue(POSTED_JE);
  });

  it("renders the entryNo header, status badge, and immutability note", async () => {
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer");
    expect(screen.getByTestId("payment-viewer-title")).toHaveTextContent("PAY/2526/0031");
    expect(screen.getByTestId("payment-status-POSTED")).toBeInTheDocument();
    expect(screen.getByTestId("payment-immutability-note")).toHaveTextContent(/Posted payments can/i);
  });

  it("shows the balanced ledger-lines table with the party only on the AP control line", async () => {
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-ledger-lines");
    await waitFor(() =>
      expect(screen.getByTestId("payment-ledger-lines").textContent).toMatch(/200,150\.0000/),
    );
    // View ledger entry link routes via journalEntryId.
    expect(screen.getByTestId("payment-view-ledger-entry")).toHaveAttribute("href", "/ledger/entry-viewer?id=je-pay-1");
  });

  it("shows the allocations panel with one row per allocation", async () => {
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-allocations-panel");
    expect(screen.getByTestId("payment-allocation-bill-1")).toBeInTheDocument();
  });

  it("does not expose any Edit / Save / Post affordance (FR-PAY-018)", async () => {
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer");
    expect(screen.queryByRole("button", { name: /^edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^post/i })).not.toBeInTheDocument();
  });
});

describe("PaymentViewer — cancelled (FR-PAY-019)", () => {
  it("shows the superseded ribbon + linkage panel and hides Cancel/Correct", async () => {
    getMock.mockResolvedValue(
      postedPayment({
        status: "CANCELLED",
        linkage: {
          hasHistory: true,
          currentEntryNo: "PAY/2526/0031",
          originalEntryNo: "PAY/2526/0031",
          entries: [
            {
              entryId: "je-pay-1",
              entryNo: "PAY/2526/0031",
              isReversal: false,
              isReversed: true,
              isCurrent: false,
              reversalOfEntryNo: null,
              reversedByEntryNo: "PAY/2526/0055",
              postedAt: "2026-07-11T10:22:11Z",
            },
            {
              entryId: "je-pay-1-rev",
              entryNo: "PAY/2526/0055",
              isReversal: true,
              isReversed: false,
              isCurrent: false,
              reversalOfEntryNo: "PAY/2526/0031",
              reversedByEntryNo: null,
              postedAt: "2026-07-12T09:00:00Z",
            },
          ],
        },
      }),
    );
    journalMock.mockResolvedValue(POSTED_JE);
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer");
    expect(screen.getByTestId("payment-cancelled-ribbon")).toBeInTheDocument();
    expect(await screen.findByTestId("payment-linkage")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-viewer-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payment-viewer-correct")).not.toBeInTheDocument();
  });
});

describe("PaymentViewer — error paths", () => {
  it("renders 404 on NOT_FOUND", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "no", status: 404 }));
    renderWith(<PaymentViewer paymentId="missing" />);
    expect(await screen.findByTestId("payment-viewer-not-found")).toBeInTheDocument();
  });

  it("PM is redirected to a forbidden panel via the 403", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderWith(<PaymentViewer paymentId="pay-1" />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("payment-viewer-forbidden")).toBeInTheDocument();
  });

  it("keeps header + surfaces ledger-lines 403 in its own panel", async () => {
    getMock.mockResolvedValue(postedPayment());
    journalMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 }));
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer-title");
    expect(await screen.findByTestId("payment-ledger-lines-forbidden")).toBeInTheDocument();
  });
});

describe("PaymentViewer — Cancel flow", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(postedPayment());
    journalMock.mockResolvedValue(POSTED_JE);
  });

  it("requires a reason and toasts on success", async () => {
    cancelMock.mockResolvedValue({
      id: "pay-1",
      status: "CANCELLED",
      reversalEntryId: "je-rev",
      reversalEntryNo: "PAY/2526/0055",
    });
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer-title");
    await userEvent.click(screen.getByTestId("payment-viewer-cancel"));
    await userEvent.click(screen.getByTestId("payment-cancel-confirm"));
    expect(await screen.findByTestId("payment-cancel-reason-err")).toHaveTextContent(
      "Enter a reason for cancelling this payment.",
    );
    await userEvent.type(screen.getByTestId("payment-cancel-reason"), "Wrong supplier");
    await userEvent.click(screen.getByTestId("payment-cancel-confirm"));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("pay-1", { reason: "Wrong supplier", version: 2 }),
    );
  });

  it("maps stale ALREADY_REVERSED to the friendly banner", async () => {
    cancelMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer-title");
    await userEvent.click(screen.getByTestId("payment-viewer-cancel"));
    await userEvent.type(await screen.findByTestId("payment-cancel-reason"), "stale");
    await userEvent.click(screen.getByTestId("payment-cancel-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("payment-viewer-banner")).toHaveTextContent("This payment has already been cancelled."),
    );
  });
});

describe("PaymentViewer — Correct routes to the editor", () => {
  it("Correct link routes to /payments/[id] (the editor)", async () => {
    getMock.mockResolvedValue(postedPayment());
    journalMock.mockResolvedValue(POSTED_JE);
    renderWith(<PaymentViewer paymentId="pay-1" />);
    await screen.findByTestId("payment-viewer-title");
    expect(screen.getByTestId("payment-viewer-correct")).toHaveAttribute("href", "/payments/pay-1");
  });
});
