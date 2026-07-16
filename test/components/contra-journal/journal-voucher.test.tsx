/**
 * FE-50 fe-journal-voucher tests (FR-GEN-004…-018). Covers: the account-driven
 * conditional cluster (P&L reveals project+cost_centre+purpose required; AR/AP
 * control reveals party required; other balance-sheet reveals none) with the
 * clear-on-account-change; balanced-gated Post; permission-denied panel;
 * ALREADY_REVERSED mapping.
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
import { type JournalVoucher } from "@/features/contra-journal/types";
import { JournalVoucherEditor } from "@/features/contra-journal/components/JournalVoucherEditor";
import * as journalApi from "@/features/contra-journal/api/journal";
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
jest.mock("@/features/contra-journal/api/journal");
jest.mock("@/features/contra-journal/api/masters", () => ({
  ...jest.requireActual("@/features/contra-journal/api/masters"),
  listAccountOptions: jest.fn(),
  listProjectOptions: jest.fn(),
  listCostCentreOptions: jest.fn(),
  listPurposeOptions: jest.fn(),
  listPartyOptions: jest.fn(),
}));

const getMock = journalApi.getJournalVoucher as jest.Mock;
const createMock = journalApi.createJournalVoucher as jest.Mock;
const postMock = journalApi.postJournalVoucher as jest.Mock;
const reverseMock = journalApi.reverseJournalVoucher as jest.Mock;

const accountsMock = mastersApi.listAccountOptions as jest.Mock;
const projectsMock = mastersApi.listProjectOptions as jest.Mock;
const costCentresMock = mastersApi.listCostCentreOptions as jest.Mock;
const purposesMock = mastersApi.listPurposeOptions as jest.Mock;
const partiesMock = mastersApi.listPartyOptions as jest.Mock;

const ACCOUNTS = [
  { id: "5100", code: "5100", name: "Electricity expense", type: "EXPENSE" as const, isActive: true, isBankCash: false },
  { id: "2100", code: "2100", name: "Accounts payable", type: "LIABILITY" as const, isActive: true, isBankCash: false },
  { id: "1500", code: "1500", name: "Prepayments", type: "ASSET" as const, isActive: true, isBankCash: false },
  { id: "1010", code: "1010", name: "Cash on hand", type: "ASSET" as const, isActive: true, isBankCash: true },
];

function postedJournal(over: Partial<JournalVoucher> = {}): JournalVoucher {
  return {
    id: "jnl-1",
    voucherType: "JOURNAL",
    voucherDate: "2026-07-05",
    narration: "Accrue June electricity",
    status: "POSTED",
    entryNo: "JNL/2526/0022",
    journalEntryId: "je-jnl-1",
    postedAt: "2026-07-05T10:22:11Z",
    postedBy: "u1",
    version: 2,
    createdAt: "2026-07-05T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
    lines: [
      { lineNo: 1, accountId: "5100", debit: "18500.0000", credit: "0.0000", partyId: null, projectId: "proj-a", costCentreId: "cc-1", purposeId: "pp-1", narration: null },
      { lineNo: 2, accountId: "2100", debit: "0.0000", credit: "18500.0000", partyId: "pa-1", projectId: null, costCentreId: null, purposeId: null, narration: null },
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
  projectsMock.mockResolvedValue([{ id: "proj-a", name: "Bridge-04", projectCode: "BR-04", status: "OPEN" }]);
  costCentresMock.mockResolvedValue([{ id: "cc-1", name: "Superstructure" }]);
  purposesMock.mockResolvedValue([{ id: "pp-1", name: "Progress billing" }]);
  partiesMock.mockResolvedValue([{ id: "pa-1", name: "M/s Rahman Traders", isActive: true }]);
});

describe("JournalVoucherEditor — conditional cluster (spec §7 decision table)", () => {
  it("reveals project+cost_centre+purpose for a P&L (EXPENSE) line", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />);
    await screen.findByTestId("journal-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("journal-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='5100']")).toBeTruthy();
    });
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "5100");
    expect(await screen.findByTestId("journal-line-cluster-pl-l1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-line-project-l1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-line-cost-centre-l1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-line-purpose-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-line-party-l1")).not.toBeInTheDocument();
  });

  it("reveals party for an AR/AP control account (2100)", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />);
    await screen.findByTestId("journal-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("journal-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='2100']")).toBeTruthy();
    });
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "2100");
    expect(await screen.findByTestId("journal-line-cluster-control-l1")).toBeInTheDocument();
    expect(screen.getByTestId("journal-line-party-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-line-project-l1")).not.toBeInTheDocument();
  });

  it("hides the cluster entirely for a non-control balance-sheet account (1500)", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />);
    await screen.findByTestId("journal-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("journal-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='1500']")).toBeTruthy();
    });
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "1500");
    expect(await screen.findByTestId("journal-line-cluster-none-l1")).toBeInTheDocument();
  });

  it("clears now-inapplicable fields when the account changes and announces the change", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />);
    await screen.findByTestId("journal-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("journal-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='5100']")).toBeTruthy();
    });
    // Pick P&L → fill project.
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "5100");
    await waitFor(() => expect(screen.getByTestId("journal-line-project-l1")).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByTestId("journal-line-project-l1"), "proj-a");
    // Switch to control account (2100) — cluster flips to Party.
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "2100");
    expect(await screen.findByTestId("journal-line-cluster-control-l1")).toBeInTheDocument();
    // Aria-live announcement fires.
    expect(screen.getByTestId("journal-editor-cluster-announce")).toHaveTextContent(/Tags cleared/i);
  });
});

describe("JournalVoucherEditor — Post gating (FR-GEN-005/-007/-016)", () => {
  it("keeps Post disabled until Σdebit=Σcredit AND every line's required tags are filled", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />);
    await screen.findByTestId("journal-editor-title");
    await waitFor(() => {
      const sel = screen.getByTestId("journal-line-account-l1") as HTMLSelectElement;
      expect(sel.querySelector("option[value='5100']")).toBeTruthy();
    });
    // L1: EXPENSE + amount only — Post stays disabled (missing project/cost centre/purpose).
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l1"), "5100");
    await userEvent.type(screen.getByTestId("journal-line-debit-l1"), "5000");
    // L2: balance the amount but leave account empty.
    await userEvent.type(screen.getByTestId("journal-line-credit-l2"), "5000");
    expect(screen.getByTestId("journal-editor-post")).toBeDisabled();
    // Fill the P&L cluster + a valid L2 account.
    await userEvent.selectOptions(screen.getByTestId("journal-line-project-l1"), "proj-a");
    await userEvent.selectOptions(screen.getByTestId("journal-line-cost-centre-l1"), "cc-1");
    await userEvent.selectOptions(screen.getByTestId("journal-line-purpose-l1"), "pp-1");
    await userEvent.selectOptions(screen.getByTestId("journal-line-account-l2"), "1010");
    await waitFor(() => expect(screen.getByTestId("journal-editor-post")).not.toBeDisabled());
    expect(screen.getByTestId("voucher-balanced-ok")).toBeInTheDocument();
  });
});

describe("JournalVoucherEditor — posted read-only + Reverse (FR-GEN-018)", () => {
  it("renders read-only with Reverse in the action bar", async () => {
    getMock.mockResolvedValue(postedJournal());
    renderWith(<JournalVoucherEditor voucherId="jnl-1" />);
    await screen.findByTestId("journal-editor-title");
    expect(screen.getByTestId("journal-editor-posted-meta")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-editor-save-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journal-editor-post-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journal-editor-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journal-editor-post")).not.toBeInTheDocument();
    expect(screen.getByTestId("journal-editor-reverse")).toBeInTheDocument();
    expect(screen.getByTestId("journal-editor-reverse-bottom")).toBeInTheDocument();
  });

  it("maps ALREADY_REVERSED to the friendly banner", async () => {
    getMock.mockResolvedValue(postedJournal());
    reverseMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<JournalVoucherEditor voucherId="jnl-1" />);
    await screen.findByTestId("journal-editor-title");
    await userEvent.click(screen.getByTestId("journal-editor-reverse"));
    await userEvent.type(await screen.findByTestId("voucher-reverse-reason"), "Duplicate");
    await userEvent.click(screen.getByTestId("voucher-reverse-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("journal-editor-banner")).toHaveTextContent(
        "This voucher has already been reversed.",
      ),
    );
  });
});

describe("JournalVoucherEditor — role/scope (spec §11)", () => {
  it("PM sees a 403 panel on New", async () => {
    renderWith(<JournalVoucherEditor voucherId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("journal-editor-403")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-voucher-editor")).not.toBeInTheDocument();
  });
});

/** Prevent the create/post mocks from being reported as unused. */
void createMock;
void postMock;
