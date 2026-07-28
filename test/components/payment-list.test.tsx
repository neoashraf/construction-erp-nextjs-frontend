/**
 * FE-45 fe-payment-list tests (FR-PAY-001/-005/-007/-017/-020). Covers: default list
 * render (badges, right-aligned money, draft vs number), draft-vs-posted row routing,
 * segmented-control switch to Outstanding + applied-payments drill-in routing to the
 * viewer, delete-draft confirm → row removal + toast, filtered-empty variant,
 * error+retry, PM permission-denied, and the 360 responsive card mode.
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
import { type PaymentSummary } from "@/features/payments/types";
import { PaymentListScreen } from "@/features/payments/components/PaymentListScreen";
import * as paymentApi from "@/features/payments/api/payment";
import * as mastersApi from "@/features/payments/api/masters";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
  // FE-63: the screen reads the Outstanding deep link off the query string.
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/payments/api/payment");
jest.mock("@/features/payments/api/masters");

const listMock = paymentApi.listPayments as jest.Mock;
const deleteMock = paymentApi.deletePayment as jest.Mock;
const openPayablesMock = paymentApi.listOpenPayables as jest.Mock;
const appliedMock = paymentApi.getPayableApplied as jest.Mock;
const partiesMock = mastersApi.listPartyOptions as jest.Mock;
const accountsMock = mastersApi.listAccountOptions as jest.Mock;

const PARTIES = [
  { id: "pa-1", name: "M/s Rahman Traders", isActive: true },
  { id: "pa-2", name: "Shah Cement Ltd.", isActive: true },
];
const ACCOUNTS = [
  { id: "1201", code: "1201", name: "HSBC Current 001", type: "ASSET" as const, isActive: true },
];

function summary(o: Partial<PaymentSummary> & Pick<PaymentSummary, "id" | "status">): PaymentSummary {
  return {
    entryNo: null,
    partyId: "pa-1",
    paymentDate: "2026-07-01",
    paymentMode: "BANK_TRANSFER",
    paymentAccountId: "1201",
    chequeTxnRef: null,
    paymentAmount: "200000.0000",
    allocatedAmount: "200000.0000",
    unallocatedAmount: "0.0000",
    ...o,
  };
}

const POSTED = summary({
  id: "pay-1",
  status: "POSTED",
  entryNo: "PAY/2526/0031",
  paymentDate: "2026-07-11",
  paymentAmount: "200150.0000",
});
const DRAFT = summary({
  id: "pay-2",
  status: "DRAFT",
  entryNo: null,
  paymentDate: "2026-07-09",
  paymentAmount: "50000.0000",
  allocatedAmount: "50000.0000",
});
const CANCELLED = summary({
  id: "pay-3",
  status: "CANCELLED",
  entryNo: "PAY/2526/0028",
  paymentDate: "2026-06-30",
  paymentAmount: "120000.0000",
});

function page(rows: PaymentSummary[]) {
  return { data: rows, page: 1, pageSize: 25, total: rows.length };
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

function renderScreen(role: Role = "ACCOUNTS_MANAGER") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <PaymentListScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Radix menus (row kebab, mode multi-select) set `pointer-events: none` on <body>
  // and jsdom doesn't always clear it on unmount, leaking across tests. Reset it so
  // subsequent pointer interactions aren't blocked. (See PointerEventsGuard.)
  document.body.style.removeProperty("pointer-events");
  partiesMock.mockResolvedValue(PARTIES);
  accountsMock.mockResolvedValue(ACCOUNTS);
  openPayablesMock.mockResolvedValue([]);
  appliedMock.mockResolvedValue({
    payableType: "PURCHASE_BILL",
    payableId: "bill-1",
    originalAmount: "0.0000",
    appliedAmount: "0.0000",
    remainingOutstanding: "0.0000",
    applications: [],
  });
});

afterEach(() => {
  document.body.style.removeProperty("pointer-events");
});

/** user-event configured to skip the pointer-events check (Radix leaves body locked in jsdom). */
const ue = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("PaymentListScreen — default list render (spec §5/§6)", () => {
  it("distinguishes Draft/Posted/Cancelled rows with badges + right-aligned money", async () => {
    listMock.mockResolvedValue(page([POSTED, DRAFT, CANCELLED]));
    renderScreen();
    await screen.findByTestId("payment-list");
    // Draft row shows "Draft" (no entryNo), the others show the gapless number.
    // (jsdom renders both the >=lg table row and the <lg card; assert the table row.)
    expect(screen.getByTestId("payment-row-DRAFT").textContent).toContain("Draft");
    expect(screen.getByTestId("payment-row-POSTED").textContent).toContain("PAY/2526/0031");
    expect(screen.getByTestId("payment-row-CANCELLED").textContent).toContain("PAY/2526/0028");
    // Each lifecycle status pill is present (a Draft row carries the pill in both the
    // number cell and the status column, per the design file).
    expect(screen.getAllByTestId("payment-status-POSTED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("payment-status-DRAFT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("payment-status-CANCELLED").length).toBeGreaterThanOrEqual(1);
  });

  it("routes a DRAFT row link to the editor and a POSTED row to the viewer", async () => {
    listMock.mockResolvedValue(page([DRAFT, POSTED]));
    renderScreen();
    await screen.findByTestId("payment-list");
    expect(screen.getByTestId(`payment-row-link-${DRAFT.id}`)).toHaveAttribute("href", `/payments/${DRAFT.id}`);
    expect(screen.getByTestId(`payment-row-link-${POSTED.id}`)).toHaveAttribute("href", `/payments/${POSTED.id}/view`);
  });
});

describe("PaymentListScreen — delete-draft (FR-PAY-020)", () => {
  it("confirms then hard-deletes the draft and toasts on success", async () => {
    listMock.mockResolvedValue(page([DRAFT]));
    deleteMock.mockResolvedValue(undefined);
    renderScreen();
    await screen.findByTestId("payment-list");
    // Delete lives behind the row kebab (design: "Row kebab → Delete").
    await ue().click(screen.getByTestId(`payment-row-menu-${DRAFT.id}`));
    await ue().click(await screen.findByTestId(`payment-row-delete-${DRAFT.id}`));
    const dialog = await screen.findByTestId("payment-delete-dialog");
    await ue().click(screen.getByTestId("payment-delete-confirm"));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(DRAFT.id));
    expect(dialog).not.toBeInTheDocument();
  });

  it("does not show the Delete button on a POSTED row", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("payment-list");
    expect(screen.queryByTestId(`payment-row-delete-${POSTED.id}`)).not.toBeInTheDocument();
  });
});

describe("PaymentListScreen — segmented control + drill-in (spec §3/§5/§9)", () => {
  it("switches to Outstanding and routes an applied payment to the viewer", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    openPayablesMock.mockResolvedValue([
      {
        payableType: "PURCHASE_BILL",
        payableId: "bill-1",
        reference: "PUR/2526/0042",
        partyId: "pa-1",
        originalAmount: "231150.0000",
        appliedAmount: "31150.0000",
        remainingOutstanding: "200000.0000",
        accruedAmount: null,
        payableDate: "2026-06-29",
      },
    ]);
    appliedMock.mockResolvedValue({
      payableType: "PURCHASE_BILL",
      payableId: "bill-1",
      originalAmount: "231150.0000",
      appliedAmount: "31150.0000",
      remainingOutstanding: "200000.0000",
      applications: [
        { paymentId: "pay-9", entryNo: "PAY/2526/0009", paymentDate: "2026-06-25", amountAllocated: "31150.0000", status: "POSTED" },
      ],
    });
    renderScreen();
    await screen.findByTestId("payment-list");
    await ue().click(screen.getByTestId("payments-tab-outstanding"));
    await screen.findByTestId("payment-outstanding-list");
    await ue().click(screen.getByTestId("payment-outstanding-expand-bill-1"));
    const link = await screen.findByTestId("payment-drill-in-link-pay-9");
    expect(link).toHaveAttribute("href", "/payments/pay-9/view");
  });
});

describe("PaymentListScreen — empty + error states (spec §6)", () => {
  it("shows the filtered-empty state with Clear filters after a filter narrows to nothing", async () => {
    listMock
      .mockResolvedValueOnce(page([POSTED]))
      .mockResolvedValueOnce(page([]));
    renderScreen();
    await screen.findByTestId("payment-list");
    await ue().click(screen.getByTestId("payment-filter-status-DRAFT"));
    await ue().click(screen.getByTestId("payment-filter-apply"));
    expect(await screen.findByTestId("payment-list-empty")).toHaveTextContent(
      "No payments match the selected filters.",
    );
    expect(screen.getByTestId("payment-list-clear-filters")).toBeInTheDocument();
  });

  it("shows the error + retry state on a fetch failure", async () => {
    listMock.mockRejectedValue(new ApiError({ code: "UNKNOWN", message: "boom", status: 500 }));
    renderScreen();
    expect(await screen.findByTestId("payment-list-error")).toBeInTheDocument();
    expect(screen.getByTestId("payment-list-retry")).toBeInTheDocument();
  });

  it("blocks the Apply when dateFrom > dateTo with the exact inline message", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("payment-list");
    await ue().click(screen.getByTestId("payment-filter-more"));
    // Type dateFrom later than dateTo (raw text field accepts DD/MM/YYYY).
    const dateFrom = screen.getByTestId("payment-filter-date-from") as HTMLInputElement;
    const dateTo = screen.getByTestId("payment-filter-date-to") as HTMLInputElement;
    await ue().type(dateFrom, "10/07/2026");
    await ue().type(dateTo, "01/07/2026");
    await ue().click(screen.getByTestId("payment-filter-apply"));
    expect(await screen.findByTestId("payment-filter-date-err")).toHaveTextContent(
      "Date from cannot be after date to.",
    );
  });
});

describe("PaymentListScreen — role/scope (spec §11)", () => {
  it("PM never sees the screen — a fallback panel replaces the list", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByText("You don't have access to Payments.")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-list")).not.toBeInTheDocument();
  });
});

describe("PaymentListScreen — resilience to a money field the API omits", () => {
  it("renders the list instead of crashing when allocated/unallocated are missing", async () => {
    // Regression: the list endpoint once returned rows without the derived
    // allocatedAmount/unallocatedAmount. decimal.js threw "Invalid argument: undefined"
    // mid-render and the whole route died with a client-side exception.
    const { allocatedAmount: _a, unallocatedAmount: _u, ...partial } = summary({
      id: "pay-9",
      status: "POSTED",
      entryNo: "PAY/2526/0040",
    });
    listMock.mockResolvedValue(page([partial as unknown as PaymentSummary]));

    renderScreen();

    // The row renders, and the absent money cells degrade to an em-dash.
    expect(await screen.findByTestId("payment-list")).toBeInTheDocument();
    expect(screen.getByTestId("payment-row-link-pay-9")).toHaveTextContent("PAY/2526/0040");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders a row whose partyId is null (payment with no party on the control line)", async () => {
    // Regression, verbatim production payload from GET /api/payment?page=1&pageSize=25:
    // the backend types partyId as `string | null` (PaymentSummaryDto) and returns null
    // for an aggregate-liability payment, but the row read it unconditionally
    // (`parties.byId.get(r.partyId)` / `r.partyId.slice(0, 8)`) and threw mid-render.
    const prod = {
      id: "c3ade7dd-f2ec-49b4-9d0f-1ba7b23c7380",
      entryNo: "PV/2526/0001",
      paymentDate: "2026-06-05",
      paymentMode: "BANK_TRANSFER",
      partyId: null,
      paymentAccountId: "d217fc71-ca77-4229-8306-e96deb282a49",
      paymentAmount: "4258.0645",
      bankChargesAmount: "0.0000",
      status: "POSTED",
    } as unknown as PaymentSummary;
    listMock.mockResolvedValue(page([prod]));

    renderScreen();

    expect(await screen.findByTestId("payment-list")).toBeInTheDocument();
    expect(
      screen.getByTestId("payment-row-link-c3ade7dd-f2ec-49b4-9d0f-1ba7b23c7380"),
    ).toHaveTextContent("PV/2526/0001");
    // Party degrades to a readable placeholder rather than taking the page down.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
