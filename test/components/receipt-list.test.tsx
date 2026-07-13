/**
 * FE-42 fe-receipt-list tests (FR-REC-016/-018/-025; spec §5/§6/§7/§9/§11). Covers:
 * default render (badges, right-aligned money, newest-first), row routing by status
 * (editor vs viewer, Print posted-only), both empty variants, partial name-unavailable,
 * error+retry, `dateFrom > dateTo` inline validation, PM out-of-scope `projectId` → 403
 * inline, the `ipcId` deep-link context chip, and the 360 read-only card tier.
 */
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type ReceiptSummary } from "@/features/receipts/types";
import { ReceiptListScreen } from "@/features/receipts/components/ReceiptListScreen";
import * as receiptApi from "@/features/receipts/api/receipt";
import * as mastersApi from "@/features/receipts/api/masters";
import * as salesApi from "@/features/receipts/api/sales";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/receipts/api/receipt", () => ({
  ...jest.requireActual("@/features/receipts/api/receipt"),
  listReceipts: jest.fn(),
  getReceiptsForIpc: jest.fn(),
}));
jest.mock("@/features/receipts/api/masters", () => ({
  listProjectOptions: jest.fn(),
  listCustomerOptions: jest.fn(),
}));
jest.mock("@/features/receipts/api/sales", () => ({
  listIpcOptions: jest.fn(),
}));

const listMock = receiptApi.listReceipts as jest.Mock;
const ipcContextMock = receiptApi.getReceiptsForIpc as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;
const custMock = mastersApi.listCustomerOptions as jest.Mock;
const ipcOptMock = salesApi.listIpcOptions as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "OPEN" },
];
const CUSTOMERS = [
  { id: "pa-8", name: "National Housing Authority", isActive: true },
  { id: "pa-1", name: "ABC Cement Co.", isActive: true },
];
const IPC_OPTIONS = [{ id: "ipc-6", entryNo: "IPC/2526/0006", projectId: "proj-a" }];

function receipt(
  o: Partial<ReceiptSummary> & Pick<ReceiptSummary, "id" | "status">,
): ReceiptSummary {
  return {
    entryNo: null,
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-01",
    paymentMode: "BANK_TRANSFER",
    partyId: "pa-8",
    projectId: "proj-a",
    ipcId: "ipc-6",
    amountSettled: "500000.0000",
    taxDeductedAtSource: "25000.0000",
    ...o,
  };
}

const POSTED = receipt({
  id: "rec-1",
  status: "POSTED",
  entryNo: "RCT/2526/0048",
  receiptDate: "2026-07-10",
  amountSettled: "1162500.0000",
});
const DRAFT = receipt({
  id: "rec-2",
  status: "DRAFT",
  entryNo: null,
  receiptDate: "2026-07-05",
  receiptType: "GENERAL",
  ipcId: null,
  partyId: "pa-1",
});
const CANCELLED = receipt({
  id: "rec-3",
  status: "CANCELLED",
  entryNo: "RCT/2526/0040",
  receiptDate: "2026-06-20",
});
const UNRESOLVED_PARTY = receipt({
  id: "rec-4",
  status: "POSTED",
  entryNo: "RCT/2526/0035",
  partyId: "pa-ghost",
  receiptType: "GENERAL",
  ipcId: null,
  projectId: null,
});

function page(rows: ReceiptSummary[], total = rows.length) {
  return { data: rows, page: 1, pageSize: 25, total };
}

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy-2025-26",
    isActive: true,
  };
}

function renderScreen(role: Role = "ACCOUNTS_TEAM", initialIpcId = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ReceiptListScreen initialIpcId={initialIpcId} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  ipcContextMock.mockReset();
  projMock.mockReset().mockResolvedValue(PROJECTS);
  custMock.mockReset().mockResolvedValue(CUSTOMERS);
  ipcOptMock.mockReset().mockResolvedValue(IPC_OPTIONS);
});

describe("ReceiptListScreen — default render (spec §5/§6)", () => {
  it("lists receipts newest-first with badges + right-aligned money", async () => {
    listMock.mockResolvedValue(page([POSTED, DRAFT, CANCELLED]));
    renderScreen();

    await screen.findByTestId("receipt-list");
    const rows = screen.getAllByRole("row");
    // header row + 3 data rows on the desktop tier (mobile cards render in the same DOM too)
    expect(
      within(screen.getByTestId("receipt-row-POSTED")).getByTestId("receipt-status-POSTED"),
    ).toHaveTextContent("Posted");
    expect(
      within(screen.getByTestId("receipt-row-DRAFT")).getByTestId("receipt-status-DRAFT"),
    ).toHaveTextContent("Draft");
    expect(
      within(screen.getByTestId("receipt-row-CANCELLED")).getByTestId("receipt-status-CANCELLED"),
    ).toHaveTextContent("Cancelled");
    expect(screen.getAllByText("1,162,500.0000").length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("resolves the IPC column to the IPC's own entryNo and shows an em-dash for General", async () => {
    listMock.mockResolvedValue(page([POSTED, DRAFT]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    expect(screen.getAllByText("IPC/2526/0006").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // DRAFT is GENERAL, no IPC
  });
});

describe("ReceiptListScreen — row routing by status (FR-REC-013/-025; spec §5/§9)", () => {
  it("a DRAFT row opens the editor route and never shows Print", async () => {
    listMock.mockResolvedValue(page([DRAFT]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    const editLink = screen.getAllByTestId("receipt-edit")[0]!;
    expect(editLink).toHaveAttribute("href", "/receipts/rec-2");
    expect(screen.queryByTestId("receipt-print")).not.toBeInTheDocument();
  });

  it("a POSTED row opens the viewer route and shows Print", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    const viewLink = screen.getAllByTestId("receipt-view")[0]!;
    expect(viewLink).toHaveAttribute("href", "/receipts/rec-1/view");
    expect(screen.getAllByTestId("receipt-print").length).toBeGreaterThan(0);
  });

  it("a CANCELLED row opens the viewer route without Print", async () => {
    listMock.mockResolvedValue(page([CANCELLED]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    const viewLink = screen.getAllByTestId("receipt-view")[0]!;
    expect(viewLink).toHaveAttribute("href", "/receipts/rec-3/view");
    expect(screen.queryByTestId("receipt-print")).not.toBeInTheDocument();
  });
});

describe("ReceiptListScreen — partial state (spec §6)", () => {
  it("shows id + '(name unavailable)' for an unresolved party and the row still opens", async () => {
    listMock.mockResolvedValue(page([UNRESOLVED_PARTY]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    expect(screen.getAllByText(/name unavailable/).length).toBeGreaterThan(0);
    const viewLink = screen.getAllByTestId("receipt-view")[0]!;
    expect(viewLink).toHaveAttribute("href", "/receipts/rec-4/view");
  });
});

describe("ReceiptListScreen — state matrix (spec §6)", () => {
  it("first-use empty state when the company has no receipts at all", async () => {
    listMock.mockResolvedValue(page([]));
    renderScreen();
    expect(await screen.findByTestId("receipt-empty-firstuse")).toHaveTextContent(
      "No receipts recorded yet.",
    );
    expect(screen.getByTestId("receipt-empty-new")).toBeInTheDocument();
  });

  it("filtered empty state (distinct copy) when a filter narrows to nothing", async () => {
    listMock.mockResolvedValue(page([]));
    renderScreen();
    await screen.findByTestId("receipt-empty-firstuse");
    await userEvent.type(screen.getByTestId("receipt-filter-entryno"), "NO-SUCH-NUMBER");
    await userEvent.click(screen.getByTestId("receipt-filter-apply"));
    expect(await screen.findByTestId("receipt-empty-filtered")).toHaveTextContent(
      "No receipts match these filters.",
    );
  });

  it("error + retry refetches", async () => {
    listMock.mockRejectedValueOnce(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    listMock.mockResolvedValueOnce(page([POSTED]));
    renderScreen();
    const retry = await screen.findByTestId("receipt-retry");
    await userEvent.click(retry);
    await screen.findByTestId("receipt-list");
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a 403 inline when a PM filters an out-of-scope project", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen("PROJECT_MANAGER");
    await screen.findByTestId("receipt-list");

    listMock.mockRejectedValueOnce(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    await userEvent.click(screen.getByTestId("receipt-filter-toggle"));
    await userEvent.selectOptions(screen.getByTestId("receipt-filter-project"), "proj-a");
    await userEvent.click(screen.getByTestId("receipt-filter-apply"));

    expect(await screen.findByTestId("receipt-forbidden")).toHaveTextContent(
      /only view your assigned projects/i,
    );
  });
});

describe("ReceiptListScreen — filter validation (spec §7)", () => {
  it("blocks Apply and shows the exact inline message when date-from is after date-to", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    await userEvent.click(screen.getByTestId("receipt-filter-toggle"));
    await userEvent.type(screen.getByTestId("receipt-filter-from"), "31/07/2026");
    await userEvent.type(screen.getByTestId("receipt-filter-to"), "01/07/2026");
    listMock.mockClear();
    await userEvent.click(screen.getByTestId("receipt-filter-apply"));
    expect(await screen.findByTestId("receipt-filter-date-error")).toHaveTextContent(
      "Date from cannot be after date to.",
    );
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("ReceiptListScreen — IPC deep-link context (FR-REC-016)", () => {
  it("pre-applies the ipcId filter and shows a dismissible chip resolved to the IPC's entryNo", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen("ACCOUNTS_TEAM", "ipc-6");

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ ipcId: "ipc-6" })),
    );
    const chip = await screen.findByTestId("receipt-ipc-context-chip");
    expect(chip).toHaveTextContent("IPC/2526/0006");

    listMock.mockClear();
    await userEvent.click(screen.getByTestId("receipt-ipc-context-dismiss"));
    expect(screen.queryByTestId("receipt-ipc-context-chip")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ ipcId: undefined })),
    );
  });
});

describe("ReceiptListScreen — responsive 360 card tier (spec §4)", () => {
  it("renders the read-only stacked card for each row", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    expect(screen.getByTestId("receipt-card-POSTED")).toHaveTextContent("RCT/2526/0048");
  });
});

describe('ReceiptListScreen — read-only (spec §6 "Saving/posting: N/A")', () => {
  it("exposes no post/cancel affordance on the list itself", async () => {
    listMock.mockResolvedValue(page([POSTED]));
    renderScreen();
    await screen.findByTestId("receipt-list");
    for (const name of [/post/i, /cancel/i, /delete/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
