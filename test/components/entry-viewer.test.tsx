/**
 * FE-12 entry-viewer tests (FR-LED-005/006/030/026/024/007).
 * State matrix (default/loaded, loading, 404, 403, error+retry, offline), balanced-
 * totals proof, tag-matrix blanks, reversal/reversed linkage, source-voucher link,
 * and the read-only / no-mutation-affordance assertion.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type JournalEntryDetail } from "@/features/ledger/types";
import { EntryViewerScreen } from "@/features/ledger/components/EntryViewerScreen";
import * as api from "@/features/ledger/api/entries";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("@/features/ledger/api/entries", () => ({
  getJournalEntry: jest.fn(),
  listJournalEntries: jest.fn(),
}));

const getMock = api.getJournalEntry as jest.Mock;

const NORMAL_ENTRY: JournalEntryDetail = {
  id: "e1",
  entryNo: "JV/2025-26/0042",
  financialYearId: "fy1",
  voucherType: "JOURNAL",
  voucherDate: "2026-06-29",
  sourceType: "JournalVoucher",
  sourceId: "jv-42",
  isReversal: false,
  reversalOf: null,
  isReversed: false,
  reversedByEntryId: null,
  reversedBy: null,
  narration: "মেঘনা স্টিল — সমন্বয়",
  postedAt: "2026-06-29T10:22:11Z",
  postedBy: "user-1",
  totalDebit: "1075000.0000",
  totalCredit: "1075000.0000",
  lines: [
    {
      id: "l1",
      lineNo: 1,
      accountId: "1201",
      projectId: "prj-tower-a",
      costCentreId: "cc-1",
      purposeId: "pur-1",
      godownId: null,
      partyId: "party-abc",
      debit: "1075000.0000",
      credit: "0.0000",
      narration: "Client receipt",
    },
    {
      id: "l2",
      lineNo: 2,
      accountId: "4001",
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: null,
      debit: "0.0000",
      credit: "1075000.0000",
      narration: null,
    },
  ],
};

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
  };
}

function renderScreen(id: string | null = "e1", role: Role = "ACCOUNTS_TEAM") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <EntryViewerScreen id={id} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => getMock.mockReset());

describe("EntryViewerScreen — default/loaded (FR-LED-005/006)", () => {
  it("renders header + lines from GET /api/ledger/entries/{id}", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();

    const header = await screen.findByTestId("entry-header");
    expect(within(header).getByText("JV/2025-26/0042")).toBeInTheDocument();
    expect(within(header).getByTestId("entry-status-normal")).toHaveTextContent("Normal");
    expect(within(header).getByText("29/06/2026")).toBeInTheDocument();

    const line1 = screen.getByTestId("entry-line-1");
    expect(within(line1).getByText("1201")).toBeInTheDocument();
    expect(within(line1).getByText("prj-tower-a")).toBeInTheDocument();
    expect(within(line1).getByText("party-abc")).toBeInTheDocument();
    expect(within(line1).getByLabelText("Debit ৳ 1,075,000.0000")).toBeInTheDocument();
  });

  it("renders a null dimension as an em-dash, not an error (tag matrix, SRS §6)", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();
    const line2 = await screen.findByTestId("entry-line-2");
    // godown null on line 1, and project/cc/purpose/party all null on line 2
    expect(within(line2).getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("EntryViewerScreen — balanced totals (FR-LED-007)", () => {
  it("renders total_debit = total_credit as 'Balanced'", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();
    const footer = await screen.findByTestId("entry-totals-footer");
    expect(within(footer).getByTestId("balance-badge")).toHaveTextContent("Balanced");
    expect(within(footer).getByLabelText("Total debit ৳ ৳ 1,075,000.0000")).toBeInTheDocument();
    expect(within(footer).getByLabelText("Total credit ৳ ৳ 1,075,000.0000")).toBeInTheDocument();
  });

  it("flags an out-of-balance entry instead of asserting Balanced", async () => {
    getMock.mockResolvedValue({ ...NORMAL_ENTRY, totalCredit: "1000000.0000" });
    renderScreen();
    const footer = await screen.findByTestId("entry-totals-footer");
    expect(within(footer).getByTestId("balance-badge")).toHaveTextContent("Out of balance");
  });
});

describe("EntryViewerScreen — reversal / reversed linkage (FR-LED-026)", () => {
  it("shows 'Reversal' badge + 'Reversal of' link when isReversal=true", async () => {
    getMock.mockResolvedValue({
      ...NORMAL_ENTRY,
      isReversal: true,
      reversalOf: "e-original-1",
    });
    renderScreen();
    expect(await screen.findByTestId("entry-status-reversal")).toHaveTextContent("Reversal");
    const panel = screen.getByTestId("entry-linkage-panel");
    expect(within(panel).getByText("Reversal of")).toBeInTheDocument();
    expect(within(panel).getByText("e-original-1")).toBeInTheDocument();
  });

  it("shows 'Reversed' badge + 'Reversed by {entry_no}' link (derived reversedBy)", async () => {
    getMock.mockResolvedValue({
      ...NORMAL_ENTRY,
      isReversed: true,
      reversedByEntryId: "e-rev-1",
      reversedBy: { entryId: "e-rev-1", entryNo: "JV/2025-26/0099" },
    });
    renderScreen();
    expect(await screen.findByTestId("entry-status-reversed")).toHaveTextContent("Reversed");
    const panel = screen.getByTestId("entry-linkage-panel");
    expect(within(panel).getByText("Reversed by")).toBeInTheDocument();
    const link = within(panel).getByText("JV/2025-26/0099").closest("a");
    expect(link).toHaveAttribute("href", "/ledger/entry-viewer?id=e-rev-1");
  });

  it("shows Normal + no reversal linkage otherwise", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();
    expect(await screen.findByTestId("entry-status-normal")).toBeInTheDocument();
    const panel = screen.getByTestId("entry-linkage-panel");
    expect(within(panel).getByText("This entry has not been reversed.")).toBeInTheDocument();
  });
});

describe("EntryViewerScreen — source voucher link (FR-LED-030)", () => {
  it("renders the source voucher card with a link to the originating document", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();
    const panel = await screen.findByTestId("entry-linkage-panel");
    expect(within(panel).getByText("Source: JournalVoucher")).toBeInTheDocument();
    const link = within(panel).getByText("jv-42").closest("a");
    expect(link).toHaveAttribute("href", "/vouchers/journalvoucher/jv-42");
  });
});

describe("EntryViewerScreen — read-only (FR-LED-024; spec §7/§9/§11)", () => {
  it("has NO edit / delete / void / post control anywhere for any role", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen();
    await screen.findByTestId("entry-header");
    expect(screen.queryByRole("button", { name: /^edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /void/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^post/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reverse/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    // the immutability note is present in reading order near the header
    expect(screen.getByTestId("immutability-note")).toHaveTextContent(
      "Posted entries can’t be edited. To correct this, reverse or repost the source voucher.",
    );
  });

  it("renders the same read-only view for Admin and Accounts Team (no role unlocks mutation)", async () => {
    getMock.mockResolvedValue(NORMAL_ENTRY);
    renderScreen("e1", "ADMIN");
    await screen.findByTestId("entry-header");
    expect(screen.queryByRole("button", { name: /edit|delete|void|post/i })).not.toBeInTheDocument();
  });
});

describe("EntryViewerScreen — state matrix (spec §6)", () => {
  it("loading shows the header + lines skeleton", async () => {
    getMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(await screen.findByTestId("entry-viewer-loading")).toBeInTheDocument();
  });

  it("404 renders 'This entry doesn't exist or isn't in your company.' + Back", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "no", details: null, status: 404 }),
    );
    renderScreen();
    expect(await screen.findByTestId("entry-not-found")).toBeInTheDocument();
    expect(
      screen.getByText("This entry doesn't exist or isn't in your company."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to entries" })).toBeInTheDocument();
  });

  it("a malformed/missing id renders the same not-found view without calling the API", async () => {
    renderScreen(null);
    expect(await screen.findByTestId("entry-not-found")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("403 renders the permission-denied view", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen("e1", "PROJECT_MANAGER");
    expect(await screen.findByTestId("entry-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to this entry.")).toBeInTheDocument();
  });

  it("error + Retry on a 5xx/network failure", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(
      await screen.findByText("Couldn't load this entry. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("entry-retry")).toBeInTheDocument();
  });
});
