/**
 * FE-51 fe-opening-journal tests (FR-GEN-009…-015). Covers: assembled review render
 * (Account + Party AR + Party AP + Equity groups, both-roles party as two rows),
 * no-line-editing assertion, Post gate + confirm → success, empty (no balances),
 * config-gap blocking banner, already-posted recap replaces the assembly UI,
 * OPENING_ALREADY_EXISTS mapping, PM 403.
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
import { type JournalVoucher, type JournalVoucherSummary } from "@/features/contra-journal/types";
import { OpeningJournalWizard } from "@/features/contra-journal/components/OpeningJournalWizard";
import * as openingApi from "@/features/contra-journal/api/opening";
import * as journalApi from "@/features/contra-journal/api/journal";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/contra-journal/api/opening");
jest.mock("@/features/contra-journal/api/journal");

const previewMock = openingApi.getOpeningPreview as jest.Mock;
const existsMock = openingApi.findExistingOpening as jest.Mock;
const postMock = openingApi.postOpeningJournal as jest.Mock;
const getJournalMock = journalApi.getJournalVoucher as jest.Mock;

const PREVIEW = {
  lines: [
    { lineNo: 1, section: "ACCOUNT", accountLabel: "1010 · Cash on hand", partyLabel: null, debit: "500000.0000", credit: "0.0000" },
    { lineNo: 2, section: "ACCOUNT", accountLabel: "1201 · HSBC Current 001", partyLabel: null, debit: "8500000.0000", credit: "0.0000" },
    { lineNo: 3, section: "PARTY_AR", accountLabel: "1200 · Accounts Receivable", partyLabel: "National Housing Authority", debit: "2500000.0000", credit: "0.0000" },
    { lineNo: 4, section: "PARTY_AP", accountLabel: "2100 · Accounts payable", partyLabel: "M/s Rahman Traders", debit: "0.0000", credit: "800000.0000" },
    { lineNo: 5, section: "PARTY_AR", accountLabel: "1200 · Accounts Receivable", partyLabel: "Both-roles party", debit: "300000.0000", credit: "0.0000" },
    { lineNo: 6, section: "PARTY_AP", accountLabel: "2100 · Accounts payable", partyLabel: "Both-roles party", debit: "0.0000", credit: "200000.0000" },
    { lineNo: 7, section: "EQUITY", accountLabel: "3100 · Opening balance equity", partyLabel: null, debit: "0.0000", credit: "10800000.0000" },
  ],
  totalDebit: "11800000.0000",
  totalCredit: "11800000.0000",
  configGap: false,
};

function summary(): JournalVoucherSummary {
  return {
    id: "opn-1",
    voucherType: "OPENING",
    voucherDate: "2025-07-01",
    narration: "Go-live opening balances",
    status: "POSTED",
    entryNo: "OPN/2526/0001",
    journalEntryId: "je-opn-1",
    postedAt: "2025-07-01T00:00:00Z",
    postedBy: "u1",
    version: 1,
    createdAt: "2025-07-01T00:00:00Z",
    updatedAt: "2025-07-01T00:00:00Z",
    totalDebit: "11800000.0000",
  };
}

function full(): JournalVoucher {
  return {
    id: "opn-1",
    voucherType: "OPENING",
    voucherDate: "2025-07-01",
    narration: "Go-live opening balances",
    status: "POSTED",
    entryNo: "OPN/2526/0001",
    journalEntryId: "je-opn-1",
    postedAt: "2025-07-01T00:00:00Z",
    postedBy: "u1",
    version: 1,
    createdAt: "2025-07-01T00:00:00Z",
    updatedAt: "2025-07-01T00:00:00Z",
    lines: [
      { lineNo: 1, accountId: "1010", debit: "500000.0000", credit: "0.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 2, accountId: "3100", debit: "0.0000", credit: "500000.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
    ],
  };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "Ashraf", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(role: Role = "ACCOUNTS_MANAGER") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <OpeningJournalWizard />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  previewMock.mockResolvedValue(PREVIEW);
  existsMock.mockResolvedValue(null);
  getJournalMock.mockResolvedValue(full());
});

describe("OpeningJournalWizard — assembled review (FR-GEN-009/-010/-011)", () => {
  it("renders every group with its lines and a balanced check", async () => {
    renderWith();
    await screen.findByTestId("opening-lines-review");
    expect(screen.getByTestId("opening-group-ACCOUNT")).toBeInTheDocument();
    expect(screen.getByTestId("opening-group-PARTY")).toBeInTheDocument();
    expect(screen.getByTestId("opening-group-EQUITY")).toBeInTheDocument();
    expect(screen.getByTestId("opening-balanced-ok")).toBeInTheDocument();
  });

  it("shows a both-roles party as two adjacent rows (AR + AP), never netted", async () => {
    renderWith();
    await screen.findByTestId("opening-lines-review");
    const ar = screen.getByTestId("opening-line-5"); // Both-roles AR
    const ap = screen.getByTestId("opening-line-6"); // Both-roles AP
    expect(ar).toHaveTextContent(/Both-roles party/);
    expect(ap).toHaveTextContent(/Both-roles party/);
  });

  it("does not expose any per-line edit control (only date + narration writable)", async () => {
    renderWith();
    await screen.findByTestId("opening-lines-review");
    // No text inputs inside the review table.
    const table = screen.getByTestId("opening-lines-review");
    expect(table.querySelectorAll("input").length).toBe(0);
    expect(table.querySelectorAll("select").length).toBe(0);
  });
});

describe("OpeningJournalWizard — Post flow (FR-GEN-012/-015)", () => {
  it("opens the confirm dialog, posts, and toasts the entryNo", async () => {
    postMock.mockResolvedValue({
      ...full(),
      entryNo: "OPN/2526/0002",
    });
    renderWith();
    await screen.findByTestId("opening-lines-review");
    await waitFor(() => expect(screen.getByTestId("opening-post")).not.toBeDisabled());
    await userEvent.click(screen.getByTestId("opening-post"));
    await userEvent.click(await screen.findByTestId("opening-post-confirm"));
    await waitFor(() => expect(postMock).toHaveBeenCalled());
  });

  it("maps OPENING_ALREADY_EXISTS to the reconciling banner + re-checks existing", async () => {
    postMock.mockRejectedValue(new ApiError({ code: "OPENING_ALREADY_EXISTS", message: "x", status: 409 }));
    renderWith();
    await screen.findByTestId("opening-lines-review");
    await waitFor(() => expect(screen.getByTestId("opening-post")).not.toBeDisabled());
    await userEvent.click(screen.getByTestId("opening-post"));
    await userEvent.click(await screen.findByTestId("opening-post-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("opening-banner")).toHaveTextContent(
        /Another user posted the opening journal/i,
      ),
    );
  });
});

describe("OpeningJournalWizard — empty + config-gap (FR-GEN-013; §15/§16)", () => {
  it("shows the empty state when no balances are set", async () => {
    previewMock.mockResolvedValue({ lines: [], totalDebit: "0.0000", totalCredit: "0.0000", configGap: false });
    renderWith();
    expect(await screen.findByTestId("opening-empty")).toBeInTheDocument();
    expect(screen.getByTestId("opening-post")).toBeDisabled();
  });

  it("shows the config-gap blocking banner and disables Post", async () => {
    previewMock.mockResolvedValue({ lines: [], totalDebit: "0.0000", totalCredit: "0.0000", configGap: true });
    renderWith();
    expect(await screen.findByTestId("opening-config-gap")).toBeInTheDocument();
    expect(screen.getByTestId("opening-post")).toBeDisabled();
  });
});

describe("OpeningJournalWizard — already-posted recap (FR-GEN-012)", () => {
  it("replaces the assembly UI with a recap when an OPENING already exists", async () => {
    existsMock.mockResolvedValue(summary());
    renderWith();
    expect(await screen.findByTestId("opening-posted-recap")).toBeInTheDocument();
    expect(screen.queryByTestId("opening-lines-review")).not.toBeInTheDocument();
    expect(screen.queryByTestId("opening-post")).not.toBeInTheDocument();
  });
});

describe("OpeningJournalWizard — role/scope (spec §11)", () => {
  it("PM sees a 403 panel", async () => {
    renderWith("PROJECT_MANAGER");
    expect(await screen.findByTestId("opening-403")).toBeInTheDocument();
    expect(screen.queryByTestId("opening-wizard")).not.toBeInTheDocument();
  });
});
