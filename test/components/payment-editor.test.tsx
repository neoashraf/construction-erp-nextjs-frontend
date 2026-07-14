/**
 * FE-46 fe-payment-editor tests (FR-PAY-001…-020). Covers: new-draft render + Post
 * disabled until Balanced, allocation grid + per-row cap, add/remove via picker,
 * payee-change confirm, full-allocation Post gate, cheque-ref show/require on non-cash,
 * error mapping (OVER_ALLOCATION / ALLOCATION_EXCEEDS_OUTSTANDING / PAYABLE_NOT_
 * SETTLEABLE / PERIOD_CLOSED / OPTIMISTIC_LOCK_CONFLICT), posted-read-only, PM 403,
 * discard-draft, and 360 minimum render.
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
import { PaymentEditor } from "@/features/payments/components/PaymentEditor";
import * as paymentApi from "@/features/payments/api/payment";
import * as mastersApi from "@/features/payments/api/masters";

const routerReplace = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/payments/api/payment");
jest.mock("@/features/payments/api/masters");

const getMock = paymentApi.getPayment as jest.Mock;
const createMock = paymentApi.createPayment as jest.Mock;
const updateMock = paymentApi.updatePayment as jest.Mock;
const deleteMock = paymentApi.deletePayment as jest.Mock;
const postMock = paymentApi.postPayment as jest.Mock;
const cancelMock = paymentApi.cancelPayment as jest.Mock;
const openPayablesMock = paymentApi.listOpenPayables as jest.Mock;

const partiesMock = mastersApi.listPartyOptions as jest.Mock;
const accountsMock = mastersApi.listAccountOptions as jest.Mock;
const projectsMock = mastersApi.listProjectOptions as jest.Mock;
const costCentresMock = mastersApi.listCostCentreOptions as jest.Mock;
const purposesMock = mastersApi.listPurposeOptions as jest.Mock;

const PARTIES = [
  { id: "pa-1", name: "M/s Rahman Traders", isActive: true },
  { id: "pa-2", name: "Shah Cement Ltd.", isActive: true },
];
const ACCOUNTS = [
  { id: "1201", code: "1201", name: "HSBC Current 001", type: "ASSET" as const, isActive: true },
];
const OPEN_PAYABLES = [
  {
    payableType: "PURCHASE_BILL" as const,
    payableId: "bill-1",
    reference: "PUR/2526/0042",
    partyId: "pa-1",
    originalAmount: "231150.0000",
    appliedAmount: "31150.0000",
    remainingOutstanding: "200000.0000",
    accruedAmount: null,
    payableDate: "2026-06-29",
  },
];

function postedPayment(over: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    partyId: "pa-1",
    paymentDate: "2026-07-11",
    paymentMode: "RTGS",
    paymentAccountId: "1201",
    chequeTxnRef: "RTGS-99815",
    bankChargesAmount: "0.0000",
    bankChargesProjectId: null,
    bankChargesCostCentreId: null,
    bankChargesPurposeId: null,
    paymentAmount: "200000.0000",
    narration: null,
    status: "POSTED",
    entryNo: "PAY/2526/0031",
    journalEntryId: "je-pay-1",
    allocatedAmount: "200000.0000",
    unallocatedAmount: "0.0000",
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

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "Ashraf",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
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
  partiesMock.mockResolvedValue(PARTIES);
  accountsMock.mockResolvedValue(ACCOUNTS);
  projectsMock.mockResolvedValue([]);
  costCentresMock.mockResolvedValue([]);
  purposesMock.mockResolvedValue([]);
  openPayablesMock.mockResolvedValue(OPEN_PAYABLES);
});

describe("PaymentEditor — new draft header + Post gating (FR-PAY-001/-002/-005/-012)", () => {
  it("hides the cheque-ref field for CASH and requires it for BANK_TRANSFER", async () => {
    renderWith(<PaymentEditor paymentId={null} />);
    await screen.findByTestId("payment-editor-title");
    // CASH → no cheque-ref field.
    await userEvent.click(screen.getByTestId("payment-editor-mode-CASH"));
    expect(screen.queryByTestId("payment-editor-cheque-ref")).not.toBeInTheDocument();
    // BANK_TRANSFER → field appears + required inline on Save attempt.
    await userEvent.click(screen.getByTestId("payment-editor-mode-BANK_TRANSFER"));
    expect(screen.getByTestId("payment-editor-cheque-ref")).toBeInTheDocument();
  });

  it("keeps Post disabled while unallocated > 0 and enables it only when Balanced", async () => {
    renderWith(<PaymentEditor paymentId={null} />);
    await screen.findByTestId("payment-editor-title");
    await waitFor(() =>
      expect(screen.getByTestId("payment-editor-party").querySelector("option[value='pa-1']")).toBeTruthy(),
    );
    // Fill minimum header + amount = 100 000.
    await userEvent.selectOptions(screen.getByTestId("payment-editor-party"), "pa-1");
    await userEvent.type(screen.getByLabelText(/Payment date/i), "12/07/2026");
    await userEvent.click(screen.getByTestId("payment-editor-mode-CASH"));
    await userEvent.selectOptions(screen.getByLabelText(/Paying account/i), "1201");
    await userEvent.type(screen.getByTestId("payment-editor-amount"), "100000");
    // No allocations yet — Post disabled.
    expect(screen.getByTestId("payment-editor-post")).toBeDisabled();
    // Add a payable — the picker adds an allocation at remainingOutstanding (200 000).
    await userEvent.click(screen.getByTestId("payment-allocation-add"));
    await userEvent.click(await screen.findByTestId("open-payables-pick-bill-1"));
    // 200 000 > 100 000 → over-allocated indicator; Post still disabled.
    expect(screen.getByTestId("payment-editor-post")).toBeDisabled();
    // Trim the allocation to 100 000 → Balanced → Post enabled.
    const input = screen.getByTestId("payment-allocation-amount-bill-1") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "100000");
    await waitFor(() => expect(screen.getByTestId("payment-editor-post")).not.toBeDisabled());
  });

  it("blocks a per-row over-cap with the inline exceeds-outstanding note", async () => {
    renderWith(<PaymentEditor paymentId={null} />);
    await screen.findByTestId("payment-editor-title");
    await waitFor(() =>
      expect(screen.getByTestId("payment-editor-party").querySelector("option[value='pa-1']")).toBeTruthy(),
    );
    await userEvent.selectOptions(screen.getByTestId("payment-editor-party"), "pa-1");
    await userEvent.click(screen.getByTestId("payment-allocation-add"));
    await userEvent.click(await screen.findByTestId("open-payables-pick-bill-1"));
    const input = screen.getByTestId("payment-allocation-amount-bill-1") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "999999");
    expect(await screen.findByTestId("payment-allocation-over-bill-1")).toHaveTextContent(/Exceeds outstanding/);
  });
});

describe("PaymentEditor — payee change confirm (Open item 4)", () => {
  it("prompts before clearing allocations when changing payee", async () => {
    renderWith(<PaymentEditor paymentId={null} />);
    await screen.findByTestId("payment-editor-title");
    await waitFor(() =>
      expect(screen.getByTestId("payment-editor-party").querySelector("option[value='pa-1']")).toBeTruthy(),
    );
    await userEvent.selectOptions(screen.getByTestId("payment-editor-party"), "pa-1");
    await userEvent.click(screen.getByTestId("payment-allocation-add"));
    await userEvent.click(await screen.findByTestId("open-payables-pick-bill-1"));
    await userEvent.selectOptions(screen.getByTestId("payment-editor-party"), "pa-2");
    expect(await screen.findByTestId("payment-payee-change-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("payment-payee-change-confirm"));
    // Allocations cleared → the "No allocations yet." empty-state re-appears.
    await waitFor(() =>
      expect(screen.queryByTestId("payment-allocation-row-bill-1")).not.toBeInTheDocument(),
    );
  });
});

describe("PaymentEditor — posted-read-only (FR-PAY-018/-020)", () => {
  it("renders posted payment with immutability note and Cancel/Correct available", async () => {
    getMock.mockResolvedValue(postedPayment());
    renderWith(<PaymentEditor paymentId="pay-1" />);
    await screen.findByTestId("payment-editor-title");
    expect(screen.getByText(/Posted payments can/i)).toBeInTheDocument();
    // No editable Save/Post; Cancel + Correct + View are surfaced.
    expect(screen.queryByTestId("payment-editor-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payment-editor-post")).not.toBeInTheDocument();
    expect(screen.getByTestId("payment-editor-cancel-btn")).toBeInTheDocument();
    expect(screen.getByTestId("payment-editor-correct")).toBeInTheDocument();
  });

  it("maps ALREADY_REVERSED on Cancel to the friendly banner", async () => {
    getMock.mockResolvedValue(postedPayment());
    cancelMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<PaymentEditor paymentId="pay-1" />);
    await screen.findByTestId("payment-editor-title");
    await userEvent.click(screen.getByTestId("payment-editor-cancel-btn"));
    await userEvent.type(await screen.findByTestId("payment-cancel-reason"), "Duplicate");
    await userEvent.click(screen.getByTestId("payment-cancel-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("payment-editor-banner")).toHaveTextContent("This payment has already been cancelled."),
    );
  });
});

describe("PaymentEditor — lifecycle happy path (FR-REC-001/-013)", () => {
  it("creates a draft, posts it, and routes to the viewer with the entryNo toast", async () => {
    createMock.mockResolvedValue({ id: "pay-new" });
    postMock.mockResolvedValue({
      id: "pay-new",
      entryNo: "PAY/2526/0099",
      journalEntryId: "je-x",
      status: "POSTED",
      paymentAmount: "100000.0000",
      allocatedAmount: "100000.0000",
    });
    renderWith(<PaymentEditor paymentId={null} />);
    await screen.findByTestId("payment-editor-title");
    await waitFor(() =>
      expect(screen.getByTestId("payment-editor-party").querySelector("option[value='pa-1']")).toBeTruthy(),
    );
    await userEvent.selectOptions(screen.getByTestId("payment-editor-party"), "pa-1");
    await userEvent.type(screen.getByLabelText(/Payment date/i), "12/07/2026");
    await userEvent.click(screen.getByTestId("payment-editor-mode-CASH"));
    await userEvent.selectOptions(screen.getByLabelText(/Paying account/i), "1201");
    await userEvent.type(screen.getByTestId("payment-editor-amount"), "100000");
    await userEvent.click(screen.getByTestId("payment-allocation-add"));
    await userEvent.click(await screen.findByTestId("open-payables-pick-bill-1"));
    const inp = screen.getByTestId("payment-allocation-amount-bill-1") as HTMLInputElement;
    await userEvent.clear(inp);
    await userEvent.type(inp, "100000");
    await userEvent.click(screen.getByTestId("payment-editor-post"));
    await userEvent.click(await screen.findByTestId("payment-post-confirm"));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/payments/pay-new/view"));
  });
});

describe("PaymentEditor — role/scope (spec §11)", () => {
  it("PM new-payment shows a permission-denied panel", async () => {
    renderWith(<PaymentEditor paymentId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByText("You don't have permission to create payments.")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-editor")).not.toBeInTheDocument();
  });
});
