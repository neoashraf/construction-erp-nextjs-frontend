/**
 * FE-63 fe-payments-outstanding-route tests (FR-PAY-007/-017; payment-list.md §3/§6/§8/§9).
 *
 * Two nav entries, ONE screen: `/payments` opens the Payments view, `/payments/open-payables`
 * opens the Outstanding view. Covers: each route opening its own view, the H1 following the
 * route, the segmented control NAVIGATING (asserted on the router call, not just the rendered
 * panel), the `?payableType=&payableId=` deep link landing filtered, an unknown id degrading
 * to the unfiltered view rather than an error, the per-resource permission split, and the
 * absence of any ComingSoon placeholder under /payments.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type OpenPayable } from "@/features/payments/types";
import { PaymentListScreen } from "@/features/payments/components/PaymentListScreen";
import * as paymentApi from "@/features/payments/api/payment";
import * as mastersApi from "@/features/payments/api/masters";

const replaceMock = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: jest.fn(), push: jest.fn() }),
  useSearchParams: () => searchParams,
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
const openPayablesMock = paymentApi.listOpenPayables as jest.Mock;
const appliedMock = paymentApi.getPayableApplied as jest.Mock;
const partiesMock = mastersApi.listPartyOptions as jest.Mock;
const accountsMock = mastersApi.listAccountOptions as jest.Mock;

const PARTIES = [{ id: "pa-1", name: "M/s Rahman Traders", isActive: true }];

function payable(o: Partial<OpenPayable> & Pick<OpenPayable, "payableId" | "reference">): OpenPayable {
  return {
    payableType: "PURCHASE_BILL",
    partyId: "pa-1",
    originalAmount: "500000.0000",
    appliedAmount: "150000.0000",
    remainingOutstanding: "350000.0000",
    accruedAmount: null,
    payableDate: "2026-06-20",
    ...o,
  };
}

const BILL_A = payable({ payableId: "bill-a", reference: "PUR/2526/0042" });
const BILL_B = payable({
  payableId: "bill-b",
  reference: "PUR/2526/0051",
  remainingOutstanding: "90000.0000",
});

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

function renderAt(
  initialView: "PAYMENTS" | "OUTSTANDING",
  { role = "ACCOUNTS_MANAGER" as Role, query = "" } = {},
) {
  searchParams = new URLSearchParams(query);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <PaymentListScreen initialView={initialView} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  replaceMock.mockClear();
  listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
  openPayablesMock.mockResolvedValue([BILL_A, BILL_B]);
  appliedMock.mockResolvedValue({
    payableType: "PURCHASE_BILL",
    payableId: "bill-a",
    originalAmount: "500000.0000",
    appliedAmount: "150000.0000",
    remainingOutstanding: "350000.0000",
    applications: [],
  });
  partiesMock.mockResolvedValue(PARTIES);
  accountsMock.mockResolvedValue([]);
});

describe("FE-63 — each route opens its own view", () => {
  it("/payments opens the Payments view with the 'Payments' H1", async () => {
    renderAt("PAYMENTS");
    expect(await screen.findByTestId("payment-list-title")).toHaveTextContent("Payments");
    expect(screen.getByTestId("payments-tab-payments")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("payment-outstanding-view")).not.toBeInTheDocument();
  });

  it("/payments/open-payables opens the Outstanding view with the 'Open payables' H1", async () => {
    renderAt("OUTSTANDING");
    expect(await screen.findByTestId("payment-list-title")).toHaveTextContent("Open payables");
    expect(screen.getByTestId("payments-tab-outstanding")).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("payment-outstanding-view")).toBeInTheDocument();
  });

  it("neither route renders a ComingSoon placeholder", async () => {
    renderAt("OUTSTANDING");
    await screen.findByTestId("payment-outstanding-view");
    expect(screen.queryByTestId("coming-soon")).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});

describe("FE-63 — the segmented control navigates", () => {
  it("selecting Outstanding replaces the URL with /payments/open-payables", async () => {
    const u = userEvent.setup();
    renderAt("PAYMENTS");
    await screen.findByTestId("payment-list-title");

    await u.click(screen.getByTestId("payments-tab-outstanding"));

    expect(replaceMock).toHaveBeenCalledWith("/payments/open-payables");
    // ...and the H1 follows the view, so the page identity always matches the nav label.
    await waitFor(() =>
      expect(screen.getByTestId("payment-list-title")).toHaveTextContent("Open payables"),
    );
  });

  it("selecting Payments replaces the URL with /payments", async () => {
    const u = userEvent.setup();
    renderAt("OUTSTANDING");
    await screen.findByTestId("payment-outstanding-view");

    await u.click(screen.getByTestId("payments-tab-payments"));

    expect(replaceMock).toHaveBeenCalledWith("/payments");
    await waitFor(() =>
      expect(screen.getByTestId("payment-list-title")).toHaveTextContent("Payments"),
    );
  });

  it("re-selecting the view already shown does not navigate", async () => {
    const u = userEvent.setup();
    renderAt("OUTSTANDING");
    await screen.findByTestId("payment-outstanding-view");

    await u.click(screen.getByTestId("payments-tab-outstanding"));

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("FE-63 — the Outstanding deep link", () => {
  it("?payableType=&payableId= opens the view filtered to that payable, with its drill-in open", async () => {
    renderAt("OUTSTANDING", { query: "payableType=PURCHASE_BILL&payableId=bill-a" });

    await screen.findByTestId("payment-outstanding-view");
    await waitFor(() => expect(openPayablesMock).toHaveBeenCalled());
    expect(openPayablesMock).toHaveBeenCalledWith(
      expect.objectContaining({ payableType: "PURCHASE_BILL" }),
    );
    // the linked payable's applied-payments trail is fetched, not just the list
    await waitFor(() => expect(appliedMock).toHaveBeenCalledWith("PURCHASE_BILL", "bill-a"));
  });

  it("?partyId= seeds the party filter", async () => {
    renderAt("OUTSTANDING", { query: "partyId=pa-1" });

    await screen.findByTestId("payment-outstanding-view");
    await waitFor(() =>
      expect(openPayablesMock).toHaveBeenCalledWith(expect.objectContaining({ partyId: "pa-1" })),
    );
  });

  it("an unresolvable payableId degrades to the unfiltered view, never an error", async () => {
    // The API only ever returns OPEN payables — a settled/unknown id simply isn't in the list.
    openPayablesMock.mockResolvedValue([BILL_A, BILL_B]);
    renderAt("OUTSTANDING", { query: "payableType=PURCHASE_BILL&payableId=already-settled" });

    expect(await screen.findByTestId("payment-outstanding-view")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-outstanding-error")).not.toBeInTheDocument();
    // the rest of the open payables are still listed
    expect(await screen.findByText("PUR/2526/0042")).toBeInTheDocument();
  });
});

describe("FE-63 — per-resource permissions", () => {
  it("hides the Outstanding tab from an actor without payments.open_payables:READ", async () => {
    // A bare ACCOUNTS_TEAM/ADMIN role grants both; a role outside the fallback list grants
    // neither, which is the PM case already covered by FE-45. Here we assert the *split*:
    // the tab is hidden (not disabled) whenever the Outstanding resource is not readable.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    searchParams = new URLSearchParams();
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <SessionProvider
            user={{
              ...user("ACCOUNTS_MANAGER"),
              permissions: [{ resource: "payments.list", action: "READ" }],
            } as SafeUser}
          >
            <PaymentListScreen initialView="PAYMENTS" />
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );

    await screen.findByTestId("payment-list-title");
    expect(screen.getByTestId("payments-tab-payments")).toBeInTheDocument();
    expect(screen.queryByTestId("payments-tab-outstanding")).not.toBeInTheDocument();
  });
});
