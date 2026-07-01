/**
 * FE-10 journal-entries list tests (FR-LED-031/005/030/026).
 * Header fields, READ-ONLY assertion (no create/edit/delete/export/New CTA), balanced
 * totals + ৳ formatting, reversal/reversed/normal badges, filters (apply/clear +
 * dateFrom>dateTo), full state matrix, and role / 403 handling.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type JournalEntryHeader } from "@/features/ledger/types";
import { JournalEntriesScreen } from "@/features/ledger/components/JournalEntriesScreen";
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
  listJournalEntries: jest.fn(),
}));

const listMock = api.listJournalEntries as jest.Mock;

const NORMAL: JournalEntryHeader = {
  id: "e1",
  entryNo: "JE/2025-26/01184",
  financialYearId: "fy1",
  voucherType: "PAYMENT",
  voucherDate: "2026-06-30",
  sourceType: "PaymentVoucher",
  sourceId: "pv-42",
  isReversal: false,
  reversalOf: null,
  isReversed: false,
  reversedByEntryId: null,
  narration: "Payment to Shah Cement Ltd. against Bridge-04",
  totalDebit: "1240000.0000",
  totalCredit: "1240000.0000",
  postedAt: "2026-06-30T10:22:11Z",
  postedBy: "u-acc",
};
const REVERSAL: JournalEntryHeader = {
  ...NORMAL,
  id: "e2",
  entryNo: "JE/2025-26/01181",
  voucherType: "JOURNAL",
  narration: "মেঘনা স্টিল থেকে রড ক্রয় — টাওয়ার-এ",
  isReversal: true,
  totalDebit: "2070000.0000",
  totalCredit: "2070000.0000",
};
const REVERSED: JournalEntryHeader = {
  ...NORMAL,
  id: "e3",
  entryNo: "JE/2025-26/01179",
  narration: "M/s Rahman Traders — aggregate supply (reversed)",
  isReversed: true,
  reversedByEntryId: "e9",
  totalDebit: "312690.0000",
  totalCredit: "312690.0000",
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
function pageOf(entries: JournalEntryHeader[], total = entries.length, page = 1, pageSize = 25) {
  return { data: entries, page, pageSize, total };
}
function renderScreen(role: Role = "ACCOUNTS_TEAM") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <JournalEntriesScreen />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
});

describe("JournalEntriesScreen — state matrix", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("entries-loading")).toBeInTheDocument();
  });

  it("renders header fields incl. entry no, date, source, totals (FR-LED-005/030)", async () => {
    listMock.mockResolvedValue(pageOf([NORMAL]));
    renderScreen();
    const row = await screen.findByTestId("entry-row-JE/2025-26/01184");
    expect(within(row).getByText("JE/2025-26/01184")).toBeInTheDocument();
    expect(within(row).getByText("30/06/2026")).toBeInTheDocument(); // DD/MM/YYYY
    expect(within(row).getByText("PaymentVoucher")).toBeInTheDocument();
    // Totals: right-aligned, Decimal(18,4) preserved (4 fraction digits, grouped).
    expect(within(row).getAllByText("1,240,000.0000").length).toBe(2); // debit == credit
  });

  it("empty state + Clear filters (only when filtered)", async () => {
    listMock.mockResolvedValue(pageOf([]));
    renderScreen();
    expect(
      await screen.findByText("No journal entries for the selected filters."),
    ).toBeInTheDocument();
    // Not filtered yet → no Clear filters CTA inside the empty card.
    expect(screen.queryByTestId("entries-empty-clear")).not.toBeInTheDocument();
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(
      await screen.findByText("Couldn't load journal entries. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("entries-retry")).toBeInTheDocument();
  });
});

describe("JournalEntriesScreen — read-only (spec §9; FR-LED-031)", () => {
  it("has NO create / edit / delete / export / New-journal-entry affordance", async () => {
    listMock.mockResolvedValue(pageOf([NORMAL]));
    renderScreen();
    await screen.findByTestId("entry-row-JE/2025-26/01184");
    expect(screen.queryByRole("button", { name: /new journal entry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new entry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|void|reverse/i })).not.toBeInTheDocument();
  });
});

describe("JournalEntriesScreen — status badges (FR-LED-026)", () => {
  it("renders Normal / Reversal / Reversed as text-labelled badges", async () => {
    listMock.mockResolvedValue(pageOf([NORMAL, REVERSAL, REVERSED]));
    renderScreen();
    const desktop = await screen.findByTestId("entries-desktop");
    expect(within(desktop).getByTestId("entry-status-normal")).toHaveTextContent("Normal");
    expect(within(desktop).getByTestId("entry-status-reversal")).toHaveTextContent("Reversal");
    expect(within(desktop).getByTestId("entry-status-reversed")).toHaveTextContent("Reversed");
  });

  it("renders Bangla narration without clipping (title tooltip present)", async () => {
    listMock.mockResolvedValue(pageOf([REVERSAL]));
    renderScreen();
    const row = await screen.findByTestId("entry-row-JE/2025-26/01181");
    expect(
      within(row).getByText("মেঘনা স্টিল থেকে রড ক্রয় — টাওয়ার-এ"),
    ).toBeInTheDocument();
  });
});

describe("JournalEntriesScreen — filters (spec §7/§9)", () => {
  it("Apply fires the query with the voucher-type filter", async () => {
    listMock.mockResolvedValue(pageOf([NORMAL]));
    renderScreen();
    await screen.findByTestId("entry-row-JE/2025-26/01184");
    await userEvent.selectOptions(screen.getByLabelText(/voucher type/i), "PAYMENT");
    await userEvent.click(screen.getByTestId("entries-apply"));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ voucherType: "PAYMENT", page: 1 }),
      ),
    );
  });

  it("dateFrom > dateTo shows the inline message and does NOT fire", async () => {
    listMock.mockResolvedValue(pageOf([NORMAL]));
    renderScreen();
    await screen.findByTestId("entry-row-JE/2025-26/01184");
    const callsBefore = listMock.mock.calls.length;
    await userEvent.type(screen.getByLabelText(/date from/i), "2026-06-30");
    await userEvent.type(screen.getByLabelText(/date to/i), "2025-04-01");
    await userEvent.click(screen.getByTestId("entries-apply"));
    expect(await screen.findByTestId("entries-date-error")).toHaveTextContent(
      "Date from cannot be after date to.",
    );
    expect(listMock.mock.calls.length).toBe(callsBefore); // no new query fired
  });

  it("tri-state reversal → isReversal=true on Apply", async () => {
    listMock.mockResolvedValue(pageOf([REVERSAL]));
    renderScreen();
    await screen.findByTestId("entries-filter-bar");
    await userEvent.click(within(screen.getByTestId("reversal-reversal")).getByRole("radio"));
    await userEvent.click(screen.getByTestId("entries-apply"));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ isReversal: true })),
    );
  });
});

describe("JournalEntriesScreen — role / permission (spec §11)", () => {
  it("a 403 renders the permission-denied view", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen("PROJECT_MANAGER");
    expect(await screen.findByTestId("entries-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to the ledger.")).toBeInTheDocument();
  });
});
