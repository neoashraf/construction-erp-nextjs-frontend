/**
 * FE-27 Stock Journal tests (FR-INV-007…-022). List empties + role-gated New CTA; editor
 * validation (required fields, same-godown), the draft→approve→post→reverse lifecycle with
 * status-gated actions, the negative-stock warning + override dialog, and role/scope gating.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type StockJournal } from "@/features/inventory/types";
import { StockJournalListScreen } from "@/features/inventory/components/StockJournalListScreen";
import { StockJournalEditor } from "@/features/inventory/components/StockJournalEditor";
import * as sjApi from "@/features/inventory/api/stock-journal";
import * as mastersApi from "@/features/inventory/api/masters";
import * as ledgerApi from "@/features/inventory/api/stock-ledger";

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
jest.mock("@/features/inventory/api/stock-journal");
jest.mock("@/features/inventory/api/masters");
jest.mock("@/features/inventory/api/stock-ledger");

const listMock = sjApi.listStockJournals as jest.Mock;
const getMock = sjApi.getStockJournal as jest.Mock;
const createMock = sjApi.createStockJournal as jest.Mock;
const approveMock = sjApi.approveStockJournal as jest.Mock;
const postMock = sjApi.postStockJournal as jest.Mock;
const reverseMock = sjApi.reverseStockJournal as jest.Mock;

const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04" }];
const GODOWNS = [
  { id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", isActive: true },
  { id: "gd-b", code: "G-Site-B", name: "Site B store", projectId: "proj-a", isActive: true },
];
const ITEMS = [{ id: "it-cement", code: "IT-01", name: "Cement — 50kg bag", uom: "bag", isActive: true }];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Materials", isActive: true }];
const PURPOSES = [{ id: "pp-1", name: "Concreting", projectId: "proj-a", isActive: true }];
const USERS = [{ id: "u-ashraf", name: "Ashraful Alam" }];

function sj(over: Partial<StockJournal> = {}): StockJournal {
  return {
    id: "sj-1", entryNo: null, voucherDate: "2026-07-07", mode: "ISSUE", status: "DRAFT",
    fromGodownId: "gd-a", toGodownId: null, itemId: "it-cement", quantity: "50.0000", rate: null, value: null,
    projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1", issuedById: "u-ashraf", receivedById: null,
    approvedById: null, approvedAt: null, negativeStockAuthorisedById: null, negativeStockReason: null,
    journalEntryId: null, narration: "", postedAt: null, postedById: null, version: 1,
    lines: [{ lineNo: 1, side: "OUT", godownId: "gd-a", itemId: "it-cement", quantity: "50.0000", rate: null, value: null, projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1" }],
    ...over,
  };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "ADMIN") {
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
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue(GODOWNS);
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue(ITEMS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue(CCS);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue(PURPOSES);
  (mastersApi.listUserOptions as jest.Mock).mockResolvedValue(USERS);
  (ledgerApi.getStockBalance as jest.Mock).mockResolvedValue({ godownId: "gd-a", itemId: "it-cement", quantityOnHand: "1240.0000", totalValue: "672080.0000", weightedAverageRate: "542.0000", asOfDate: "2026-07-07" });
});

// ── List ──
describe("StockJournalListScreen (spec §4.A/§6)", () => {
  it("renders journals with status badges", async () => {
    listMock.mockResolvedValue({ data: [sj({ id: "sj-1", entryNo: "SJ/2526/0010", status: "POSTED", value: "108400.0000" })], page: 1, pageSize: 25, total: 1 });
    renderWith(<StockJournalListScreen />);
    await screen.findByTestId("sj-list");
    expect(screen.getAllByText("SJ/2526/0010").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("sj-list")).getAllByTestId("sj-status-POSTED").length).toBeGreaterThan(0);
  });

  it("shows the first-use empty state (no filters) vs filtered empty", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<StockJournalListScreen />);
    expect(await screen.findByTestId("sj-empty-firstuse")).toHaveTextContent(/No Stock Journals yet/i);
    await userEvent.selectOptions(screen.getByTestId("sj-f-status"), "POSTED");
    await userEvent.click(screen.getByTestId("sj-f-apply"));
    expect(await screen.findByTestId("sj-empty-filtered")).toHaveTextContent(/No Stock Journals match/i);
  });

  it("hides the New CTA for read-only roles (PM/Accounts), shows it for Store Keeper/Admin", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    const { unmount } = renderWith(<StockJournalListScreen />, "PROJECT_MANAGER");
    await screen.findByTestId("sj-empty-firstuse");
    expect(screen.queryByTestId("sj-new")).not.toBeInTheDocument();
    unmount();
    renderWith(<StockJournalListScreen />, "STORE_KEEPER");
    await screen.findByTestId("sj-empty-firstuse");
    expect(screen.getByTestId("sj-new")).toBeInTheDocument();
  });
});

// ── Editor validation ──
describe("StockJournalEditor — validation (spec §7/§8)", () => {
  it("blocks Save with inline messages when required fields are empty", async () => {
    renderWith(<StockJournalEditor id="new" />, "STORE_KEEPER");
    await screen.findByTestId("sj-editor-title");
    await userEvent.click(screen.getByTestId("sj-save"));
    expect(await screen.findByText("Select an item.")).toBeInTheDocument();
    expect(screen.getByText("Enter a quantity greater than zero.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("flags a same-godown transfer", async () => {
    renderWith(<StockJournalEditor id="new" />, "STORE_KEEPER");
    await screen.findByTestId("sj-editor-title");
    await userEvent.click(screen.getByTestId("sj-mode-TRANSFER"));
    await screen.findByRole("option", { name: /Cement/ });
    await userEvent.selectOptions(screen.getByTestId("sj-item"), "it-cement");
    await userEvent.type(screen.getByTestId("sj-qty"), "10");
    // OUT + IN project → godown options appear
    await userEvent.selectOptions(screen.getByTestId("sj-out-project"), "proj-a");
    await userEvent.selectOptions(screen.getByTestId("sj-out-cost-centre"), "cc-mat");
    await userEvent.selectOptions(screen.getByTestId("sj-in-project"), "proj-a");
    await userEvent.selectOptions(screen.getByTestId("sj-in-cost-centre"), "cc-mat");
    await screen.findAllByRole("option", { name: /G-Site-A/ });
    await userEvent.selectOptions(screen.getByTestId("sj-out-godown"), "gd-a");
    await userEvent.selectOptions(screen.getByTestId("sj-in-godown"), "gd-a");
    await userEvent.selectOptions(screen.getByTestId("sj-out-purpose"), "pp-1");
    await userEvent.selectOptions(screen.getByTestId("sj-in-purpose"), "pp-1");
    await userEvent.click(screen.getByTestId("sj-save"));
    expect(await screen.findByText("Source and destination can't be the same godown.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a draft and navigates to it when valid", async () => {
    createMock.mockResolvedValue(sj({ id: "sj-new" }));
    renderWith(<StockJournalEditor id="new" />, "STORE_KEEPER");
    await screen.findByRole("option", { name: /Cement/ });
    await userEvent.click(screen.getByTestId("sj-mode-ISSUE"));
    await userEvent.selectOptions(screen.getByTestId("sj-item"), "it-cement");
    await userEvent.type(screen.getByTestId("sj-qty"), "50");
    await userEvent.selectOptions(screen.getByTestId("sj-out-project"), "proj-a");
    await userEvent.selectOptions(screen.getByTestId("sj-out-cost-centre"), "cc-mat");
    await screen.findAllByRole("option", { name: /G-Site-A/ });
    await userEvent.selectOptions(screen.getByTestId("sj-out-godown"), "gd-a");
    await userEvent.selectOptions(screen.getByTestId("sj-out-purpose"), "pp-1");
    await userEvent.click(screen.getByTestId("sj-save"));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(routerReplace).toHaveBeenCalledWith("/inventory/stock-journals/sj-new");
  });
});

// ── Lifecycle ──
describe("StockJournalEditor — lifecycle (FR-INV-012/018/020)", () => {
  it("approve → post reveals the right action at each status (Admin)", async () => {
    let current = sj({ status: "DRAFT", version: 1 });
    getMock.mockImplementation(() => Promise.resolve(current));
    approveMock.mockImplementation(() => { current = sj({ status: "APPROVED", version: 2 }); return Promise.resolve(current); });
    postMock.mockImplementation(() => { current = sj({ status: "POSTED", version: 3, entryNo: "SJ/2526/0018", journalEntryId: "je-1", value: "27100.0000" }); return Promise.resolve(current); });

    renderWith(<StockJournalEditor id="sj-1" />, "ADMIN");
    await screen.findByTestId("sj-approve");
    expect(screen.queryByTestId("sj-post")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("sj-approve"));
    await screen.findByTestId("sj-post");
    expect(screen.queryByTestId("sj-approve")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("sj-post"));
    await screen.findByTestId("sj-reverse");
    expect(within(screen.getByTestId("sj-editor-title").parentElement as HTMLElement).getByTestId("sj-status-POSTED")).toBeInTheDocument();
  });

  it("posts a value-neutral TRANSFER with the no-ledger-entry toast", async () => {
    const current = sj({ mode: "TRANSFER", status: "APPROVED", version: 2, toGodownId: "gd-b" });
    getMock.mockResolvedValue(current);
    postMock.mockResolvedValue(sj({ mode: "TRANSFER", status: "POSTED", version: 3, entryNo: null, journalEntryId: null }));
    renderWith(<StockJournalEditor id="sj-1" />, "ADMIN");
    await userEvent.click(await screen.findByTestId("sj-post"));
    expect(await screen.findByText(/No ledger entry \(value-neutral transfer\)/i)).toBeInTheDocument();
  });

  it("reverses a POSTED journal with a mandatory reason (Accounts)", async () => {
    getMock.mockResolvedValue(sj({ status: "POSTED", version: 3, entryNo: "SJ/2526/0010", journalEntryId: "je-1", value: "27100.0000" }));
    reverseMock.mockResolvedValue(sj({ status: "CANCELLED", version: 4 }));
    renderWith(<StockJournalEditor id="sj-1" />, "ACCOUNTS_TEAM");
    await userEvent.click(await screen.findByTestId("sj-reverse"));
    await screen.findByTestId("sj-reverse-dialog");
    await userEvent.click(screen.getByTestId("sj-reverse-confirm")); // empty reason → blocked
    expect(await screen.findByTestId("sj-reverse-reason-error")).toBeInTheDocument();
    expect(reverseMock).not.toHaveBeenCalled();
    await userEvent.type(screen.getByTestId("sj-reverse-reason"), "Wrong godown");
    await userEvent.click(screen.getByTestId("sj-reverse-confirm"));
    await waitFor(() => expect(reverseMock).toHaveBeenCalledWith("sj-1", "Wrong godown", 3));
  });
});

// ── Negative stock ──
describe("StockJournalEditor — negative stock (FR-INV-014/015)", () => {
  it("shows the warning banner when quantity exceeds on hand", async () => {
    (ledgerApi.getStockBalance as jest.Mock).mockResolvedValue({ godownId: "gd-a", itemId: "it-cement", quantityOnHand: "10.0000", totalValue: "5420.0000", weightedAverageRate: "542.0000", asOfDate: "2026-07-07" });
    getMock.mockResolvedValue(sj({ status: "APPROVED", version: 2, quantity: "50.0000" }));
    renderWith(<StockJournalEditor id="sj-1" />, "ADMIN");
    expect(await screen.findByTestId("sj-negative-warning")).toHaveTextContent(/exceeds/i);
  });

  it("opens the override dialog for an authorised (Admin) actor and posts with a reason", async () => {
    (ledgerApi.getStockBalance as jest.Mock).mockResolvedValue({ godownId: "gd-a", itemId: "it-cement", quantityOnHand: "10.0000", totalValue: "5420.0000", weightedAverageRate: "542.0000", asOfDate: "2026-07-07" });
    getMock.mockResolvedValue(sj({ status: "APPROVED", version: 2, quantity: "50.0000" }));
    postMock.mockResolvedValue(sj({ status: "POSTED", version: 3, entryNo: "SJ/2526/0018", journalEntryId: "je-1" }));
    renderWith(<StockJournalEditor id="sj-1" />, "ADMIN");
    await screen.findByTestId("sj-negative-warning");
    await userEvent.click(screen.getByTestId("sj-post"));
    await screen.findByTestId("sj-negative-dialog");
    await userEvent.click(screen.getByTestId("sj-negative-authorise"));
    await userEvent.type(screen.getByTestId("sj-negative-reason"), "issued before next delivery");
    await userEvent.click(screen.getByTestId("sj-negative-confirm"));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("sj-1", expect.objectContaining({ allowNegativeStock: true, negativeStockReason: "issued before next delivery" })),
    );
  });

  it("hard-stops an unauthorised actor with NEGATIVE_STOCK_BLOCKED (no override dialog)", async () => {
    (ledgerApi.getStockBalance as jest.Mock).mockResolvedValue({ godownId: "gd-a", itemId: "it-cement", quantityOnHand: "10.0000", totalValue: "5420.0000", weightedAverageRate: "542.0000", asOfDate: "2026-07-07" });
    getMock.mockResolvedValue(sj({ status: "APPROVED", version: 2, quantity: "50.0000" }));
    postMock.mockRejectedValue(new ApiError({ code: "NEGATIVE_STOCK_BLOCKED", message: "no", details: null, status: 409 }));
    renderWith(<StockJournalEditor id="sj-1" />, "STORE_KEEPER");
    await screen.findByTestId("sj-negative-warning");
    await userEvent.click(screen.getByTestId("sj-post"));
    expect(screen.queryByTestId("sj-negative-dialog")).not.toBeInTheDocument();
    expect(await screen.findByTestId("sj-action-error")).toHaveTextContent(/below zero/i);
  });
});

// ── Role gating ──
describe("StockJournalEditor — role gating (spec §11)", () => {
  it("a PM sees Approve on a DRAFT but no Save/Post/Reverse", async () => {
    getMock.mockResolvedValue(sj({ status: "DRAFT" }));
    renderWith(<StockJournalEditor id="sj-1" />, "PROJECT_MANAGER");
    await screen.findByTestId("sj-approve");
    expect(screen.queryByTestId("sj-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sj-post")).not.toBeInTheDocument();
  });

  it("a Store Keeper cannot approve but can post an APPROVED journal", async () => {
    getMock.mockResolvedValue(sj({ status: "APPROVED", version: 2 }));
    renderWith(<StockJournalEditor id="sj-1" />, "STORE_KEEPER");
    await screen.findByTestId("sj-post");
    expect(screen.queryByTestId("sj-approve")).not.toBeInTheDocument();
  });
});
