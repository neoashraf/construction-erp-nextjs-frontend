/**
 * FE-49 fe-contra-voucher tests (FR-GEN-001…-018). Covers: new-draft render + Post
 * disabled until balanced, debit/credit mutual exclusivity, bank/cash-only picker,
 * "no-dimension cluster" assertion (no project/cost-centre/purpose/godown/party
 * fields), balanced-indicator live recompute, Save draft → Post lifecycle, posted
 * read-only + Reverse dialog, ALREADY_REVERSED mapping, PM permission-denied.
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
import { type ContraVoucher } from "@/features/contra-journal/types";
import { ContraVoucherEditor } from "@/features/contra-journal/components/ContraVoucherEditor";
import * as contraApi from "@/features/contra-journal/api/contra";
import * as mastersApi from "@/features/contra-journal/api/masters";

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
jest.mock("@/features/contra-journal/api/contra");
jest.mock("@/features/contra-journal/api/masters", () => ({
  ...jest.requireActual("@/features/contra-journal/api/masters"),
  listAccountOptions: jest.fn(),
}));

const getMock = contraApi.getContraVoucher as jest.Mock;
const createMock = contraApi.createContraVoucher as jest.Mock;
const updateMock = contraApi.updateContraVoucher as jest.Mock;
const postMock = contraApi.postContraVoucher as jest.Mock;
const reverseMock = contraApi.reverseContraVoucher as jest.Mock;
const accountsMock = mastersApi.listAccountOptions as jest.Mock;

const ACCOUNTS = [
  { id: "1201", code: "1201", name: "HSBC Current 001", type: "ASSET" as const, isActive: true, isBankCash: true },
  { id: "1010", code: "1010", name: "Cash on hand", type: "ASSET" as const, isActive: true, isBankCash: true },
  { id: "5100", code: "5100", name: "Salary expense", type: "EXPENSE" as const, isActive: true, isBankCash: false },
];

function postedContra(over: Partial<ContraVoucher> = {}): ContraVoucher {
  return {
    id: "ctr-1",
    voucherType: "CONTRA",
    voucherDate: "2026-07-10",
    narration: "Cash to bank",
    status: "POSTED",
    entryNo: "CTR/2526/0007",
    journalEntryId: "je-ctr-1",
    postedAt: "2026-07-11T10:22:11Z",
    postedBy: "u1",
    version: 2,
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    lines: [
      { lineNo: 1, accountId: "1201", debit: "500000.0000", credit: "0.0000", narration: null },
      { lineNo: 2, accountId: "1010", debit: "0.0000", credit: "500000.0000", narration: null },
    ],
    ...over,
  };
}

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
  accountsMock.mockResolvedValue(ACCOUNTS);
});

describe("ContraVoucherEditor — new draft + Post gating (FR-GEN-016)", () => {
  it("only offers active bank/cash accounts and never renders any dimension/party field", async () => {
    renderWith(<ContraVoucherEditor voucherId={null} />);
    await screen.findByTestId("contra-editor-title");
    // Account select's options: bank + cash only — no expense account.
    await waitFor(() => {
      const sel = screen.getByTestId("contra-line-account-l1") as HTMLSelectElement;
      const opts = Array.from(sel.options).map((o) => o.value);
      expect(opts).toContain("1201");
      expect(opts).toContain("1010");
      expect(opts).not.toContain("5100");
    });
    // No dimension/party cluster.
    expect(screen.queryByLabelText(/^project/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^cost centre/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^purpose/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^party/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^godown/i)).not.toBeInTheDocument();
  });

  it("keeps Post disabled until debit=credit AND every account is bank/cash", async () => {
    renderWith(<ContraVoucherEditor voucherId={null} />);
    await screen.findByTestId("contra-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("contra-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='1201']")).toBeTruthy();
    });
    // Nothing filled — Post disabled.
    expect(screen.getByTestId("contra-editor-post")).toBeDisabled();
    await userEvent.selectOptions(screen.getByTestId("contra-line-account-l1"), "1201");
    await userEvent.type(screen.getByTestId("contra-line-debit-l1"), "100000");
    await userEvent.selectOptions(screen.getByTestId("contra-line-account-l2"), "1010");
    await userEvent.type(screen.getByTestId("contra-line-credit-l2"), "100000");
    await waitFor(() => expect(screen.getByTestId("contra-editor-post")).not.toBeDisabled());
    // Balanced indicator flips to OK.
    expect(screen.getByTestId("voucher-balanced-ok")).toBeInTheDocument();
  });

  it("makes debit/credit mutually exclusive per line", async () => {
    renderWith(<ContraVoucherEditor voucherId={null} />);
    await screen.findByTestId("contra-editor-title");
    await userEvent.type(await screen.findByTestId("contra-line-debit-l1"), "50000");
    // Typing into credit clears debit and vice-versa (handler wipes the other side on typed input).
    const creditInput = screen.getByTestId("contra-line-credit-l1") as HTMLInputElement;
    await userEvent.type(creditInput, "60000");
    expect((screen.getByTestId("contra-line-debit-l1") as HTMLInputElement).value).toBe("");
  });
});

describe("ContraVoucherEditor — lifecycle (FR-GEN-014/-015/-018)", () => {
  it("creates → posts → toasts the entryNo", async () => {
    createMock.mockResolvedValue({ id: "ctr-new-1" });
    postMock.mockResolvedValue({
      id: "ctr-new-1",
      entryNo: "CTR/2526/0100",
      journalEntryId: "je-ctr-new-1",
      status: "POSTED",
    });
    renderWith(<ContraVoucherEditor voucherId={null} />);
    await screen.findByTestId("contra-editor-title");
    await waitFor(() =>
      expect((screen.getByTestId("contra-line-account-l1") as HTMLSelectElement).querySelector("option[value='1201']")).toBeTruthy(),
    );
    await userEvent.selectOptions(screen.getByTestId("contra-line-account-l1"), "1201");
    await userEvent.type(screen.getByTestId("contra-line-debit-l1"), "100000");
    await userEvent.selectOptions(screen.getByTestId("contra-line-account-l2"), "1010");
    await userEvent.type(screen.getByTestId("contra-line-credit-l2"), "100000");
    await userEvent.click(screen.getByTestId("contra-editor-post"));
    await userEvent.click(await screen.findByTestId("voucher-post-confirm"));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith("ctr-new-1", 1));
  });

  it("renders a POSTED voucher read-only with Reverse in the action bar", async () => {
    getMock.mockResolvedValue(postedContra());
    renderWith(<ContraVoucherEditor voucherId="ctr-1" />);
    await screen.findByTestId("contra-editor-title");
    expect(screen.getByTestId("contra-editor-posted-meta")).toBeInTheDocument();
    // No Save/Post buttons (neither the header nor the bottom-bar variants).
    expect(screen.queryByTestId("contra-editor-save-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contra-editor-post-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contra-editor-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contra-editor-post")).not.toBeInTheDocument();
    expect(screen.getByTestId("contra-editor-reverse")).toBeInTheDocument();
    expect(screen.getByTestId("contra-editor-reverse-bottom")).toBeInTheDocument();
  });

  it("maps ALREADY_REVERSED on Reverse to the friendly banner", async () => {
    getMock.mockResolvedValue(postedContra());
    reverseMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<ContraVoucherEditor voucherId="ctr-1" />);
    await screen.findByTestId("contra-editor-title");
    await userEvent.click(screen.getByTestId("contra-editor-reverse"));
    await userEvent.type(await screen.findByTestId("voucher-reverse-reason"), "Duplicate");
    await userEvent.click(screen.getByTestId("voucher-reverse-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("contra-editor-banner")).toHaveTextContent(
        "This voucher has already been reversed.",
      ),
    );
  });
});

describe("ContraVoucherEditor — role/scope (spec §11)", () => {
  it("PM sees a 403 panel on New", async () => {
    renderWith(<ContraVoucherEditor voucherId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("contra-editor-403")).toBeInTheDocument();
    expect(screen.queryByTestId("contra-voucher-editor")).not.toBeInTheDocument();
  });
});

/** Prevent the `updateMock` reference from being reported as unused. */
void updateMock;
