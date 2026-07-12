/**
 * FE-34 IPC viewer + Mushak print tests (FR-SAL-010/-012/-016/-021/-022/-024). Covers the
 * viewer's default (POSTED) + CANCELLED states with the linkage panel, the balanced
 * ledger-lines table (party on control lines · no godown column), the no-edit-affordance
 * assertion, 404 + 403 + partial name-unavailable, "View in ledger" routing via
 * journalEntryId, PM Correct/Cancel gating, ledger-lines 403 in-panel state (brief G3),
 * and the Mushak print preview's default · "Not on file" partial · generation-failure.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type Ipc } from "@/features/sales-ipc/types";
import { IpcViewer } from "@/features/sales-ipc/components/IpcViewer";
import { MushakPrintPreviewScreen } from "@/features/sales-ipc/components/MushakPrintPreviewScreen";
import * as ipcApi from "@/features/sales-ipc/api/ipc";
import * as ledgerApi from "@/features/sales-ipc/api/ledger";
import * as mushakApi from "@/features/sales-ipc/api/mushak-refs";
import { apiClient } from "@/lib/api";

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
jest.mock("@/features/sales-ipc/api/ipc");
jest.mock("@/features/sales-ipc/api/ledger");
jest.mock("@/features/sales-ipc/api/mushak-refs");
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const getMock = ipcApi.getIpc as jest.Mock;
const getEntryMock = ledgerApi.getJournalEntry as jest.Mock;
const getCompanyMock = mushakApi.getCompanyProfile as jest.Mock;
const getPartyMock = mushakApi.getPartyProfile as jest.Mock;
const apiGetMock = apiClient.get as jest.Mock;

function ipc(over: Partial<Ipc> = {}): Ipc {
  return {
    id: "ipc-7",
    projectId: "proj-a",
    customerId: "pa-8",
    ipcSeqNo: 7,
    ipcDate: "2026-07-12",
    billDate: "2026-07-12",
    dueDate: "2026-08-11",
    workCompletedPct: "45.0000",
    certifiedAmount: "1000000.0000",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    outputVatAmount: "75000.0000",
    aitTdsAmount: "50000.0000",
    retentionAmount: "100000.0000",
    advanceRecoveredAmount: "150000.0000",
    currentlyDueAmount: "775000.0000",
    retentionRatePct: "10.0000",
    advanceRatePct: "15.0000",
    narration: null,
    status: "POSTED",
    entryNo: "IPC/2526/0007",
    journalEntryId: "je-7",
    outstandingAmount: "775000.0000",
    retentionHeldAmount: "100000.0000",
    postedAt: "2026-07-12T05:30:00Z",
    postedBy: "u1",
    version: 2,
    linkage: { hasHistory: false, currentEntryNo: "IPC/2526/0007", originalEntryNo: "IPC/2526/0007", entries: [] },
    ...over,
  };
}

function entry(over: Partial<ledgerApi.JournalEntry> = {}): ledgerApi.JournalEntry {
  return {
    id: "je-7",
    entryNo: "IPC/2526/0007",
    voucherType: "SALES_IPC",
    voucherDate: "2026-07-12",
    postedAt: "2026-07-12T05:30:00Z",
    totalDebit: "1075000.0000",
    totalCredit: "1075000.0000",
    lines: [
      { id: "l1", lineNo: 1, accountId: "1200", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: "pa-8", debit: "775000.0000", credit: "0.0000", narration: null },
      { id: "l2", lineNo: 2, accountId: "1210", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: "pa-8", debit: "100000.0000", credit: "0.0000", narration: null },
      { id: "l3", lineNo: 3, accountId: "1310", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: "pa-8", debit: "150000.0000", credit: "0.0000", narration: null },
      { id: "l4", lineNo: 4, accountId: "1450", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: null, debit: "50000.0000", credit: "0.0000", narration: null },
      { id: "l5", lineNo: 5, accountId: "4100", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1", godownId: null, partyId: null, debit: "0.0000", credit: "1000000.0000", narration: null },
      { id: "l6", lineNo: 6, accountId: "2310", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1", godownId: null, partyId: null, debit: "0.0000", credit: "75000.0000", narration: null },
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
  apiGetMock.mockResolvedValue({ data: [] });
});

describe("IpcViewer — posted default (spec §4, FR-SAL-010/-012/-016)", () => {
  beforeEach(() => {
    getMock.mockResolvedValue(ipc());
    getEntryMock.mockResolvedValue(entry());
  });

  it("renders the gapless Mushak entry number, status badge, and immutability note", async () => {
    renderWith(<IpcViewer ipcId="ipc-7" />);
    await screen.findByTestId("ipc-viewer");
    expect(screen.getByTestId("ipc-viewer-title")).toHaveTextContent("IPC/2526/0007");
    expect(screen.getByTestId("ipc-status-POSTED")).toBeInTheDocument();
    expect(screen.getByTestId("ipc-immutability-note")).toHaveTextContent(/Posted IPCs can’t be edited|Posted IPCs can't be edited/);
  });

  it("renders the balanced totals footer (never re-derives from the lines)", async () => {
    renderWith(<IpcViewer ipcId="ipc-7" />);
    const totals = await screen.findByTestId("ipc-lines-totals");
    expect(totals).toHaveTextContent("Balanced");
    // Both totals are shown; the viewer displays what the backend wrote.
    // Platform-wide formatMoney uses western digit grouping (not Bangla-lakh); a documented
    // deviation from the design's 2-dp Bangla-lakh grouping — see the board's standing note.
    expect(totals.textContent).toContain("1,075,000.0000");
  });

  it("has NO in-place Save/Post/Cancel/Repost control (read-only surface, FR-SAL-021)", async () => {
    renderWith(<IpcViewer ipcId="ipc-7" />);
    await screen.findByTestId("ipc-viewer");
    expect(screen.queryByTestId("ipc-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-post")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-discard")).not.toBeInTheDocument();
    // "Correct this IPC" and "Cancel this IPC" ARE present but as navigation links
    // to the editor, not in-place actions.
    const correct = screen.getByTestId("ipc-viewer-correct");
    expect(correct.tagName).not.toBe("BUTTON");
  });

  it("routes 'View in ledger' via the IPC's journalEntryId", async () => {
    renderWith(<IpcViewer ipcId="ipc-7" />);
    await screen.findByTestId("ipc-viewer");
    const link = screen.getByTestId("ipc-viewer-view-in-ledger");
    expect(link.getAttribute("href")).toContain("/ledger/entry-viewer?id=je-7");
  });

  it("shows the ledger-lines grid without a Godown column (structural omission for SALES_IPC)", async () => {
    renderWith(<IpcViewer ipcId="ipc-7" />);
    const grid = await screen.findByTestId("ipc-lines-grid");
    expect(grid.textContent).not.toMatch(/Godown/);
    // Party header still present (control lines carry the customer).
    expect(grid.textContent).toContain("Party");
    // Line 5 (Revenue) is a P&L line; party column blank; project pill rendered.
    expect(screen.getByTestId("ipc-line-5")).toBeInTheDocument();
  });
});

describe("IpcViewer — CANCELLED state (FR-SAL-022; spec §5.5)", () => {
  it("renders the superseded ribbon + linkage panel bound to `linkage.entries`", async () => {
    getMock.mockResolvedValue(
      ipc({
        status: "CANCELLED",
        linkage: {
          hasHistory: true,
          currentEntryNo: "IPC/2526/0007",
          originalEntryNo: "IPC/2526/0007",
          entries: [
            { entryId: "je-7", entryNo: "IPC/2526/0007", isReversal: false, isReversed: true, isCurrent: false, reversalOfEntryNo: null, reversedByEntryNo: "IPC/2526/0012", postedAt: "2026-07-12T05:30:00Z" },
            { entryId: "je-7-rev", entryNo: "IPC/2526/0012", isReversal: true, isReversed: false, isCurrent: false, reversalOfEntryNo: "IPC/2526/0007", reversedByEntryNo: null, postedAt: "2026-07-13T05:30:00Z" },
          ],
        },
      }),
    );
    getEntryMock.mockResolvedValue(entry());
    renderWith(<IpcViewer ipcId="ipc-7" />);
    expect(await screen.findByTestId("ipc-cancelled-ribbon")).toHaveTextContent(/superseded|Superseded/i);
    expect(screen.getByTestId("ipc-cancelled-ribbon")).toHaveTextContent("IPC/2526/0012");
    // Linkage panel visible with both rows.
    expect(screen.getByTestId("ipc-linkage")).toBeInTheDocument();
    expect(screen.getByTestId("ipc-linkage-reversed-by")).toHaveTextContent("IPC/2526/0012");
    expect(screen.getByTestId("ipc-linkage-reversal-of")).toHaveTextContent("IPC/2526/0007");
    // No Correct/Cancel link on a CANCELLED IPC.
    expect(screen.queryByTestId("ipc-viewer-correct")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-viewer-cancel")).not.toBeInTheDocument();
  });

  it("omits the linkage panel entirely when `hasHistory` is false", async () => {
    getMock.mockResolvedValue(ipc());
    getEntryMock.mockResolvedValue(entry());
    renderWith(<IpcViewer ipcId="ipc-7" />);
    await screen.findByTestId("ipc-viewer");
    expect(screen.queryByTestId("ipc-linkage")).not.toBeInTheDocument();
  });
});

describe("IpcViewer — permission gating (spec §11)", () => {
  it("PM sees no Correct/Cancel navigation links", async () => {
    getMock.mockResolvedValue(ipc());
    getEntryMock.mockResolvedValue(entry());
    renderWith(<IpcViewer ipcId="ipc-7" />, "PROJECT_MANAGER");
    await screen.findByTestId("ipc-viewer");
    expect(screen.queryByTestId("ipc-viewer-correct")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-viewer-cancel")).not.toBeInTheDocument();
  });

  it("shows the in-panel 403 state for the ledger-lines call (brief G3, distinct grant)", async () => {
    getMock.mockResolvedValue(ipc());
    getEntryMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "Nope", details: null, status: 403 }));
    renderWith(<IpcViewer ipcId="ipc-7" />, "PROJECT_MANAGER");
    await screen.findByTestId("ipc-viewer");
    expect(await screen.findByTestId("ipc-lines-forbidden")).toBeInTheDocument();
    // The header + key figures still rendered — the whole screen didn't blank.
    expect(screen.getByTestId("ipc-key-figures")).toBeInTheDocument();
  });

  it("shows the retry state for a non-403 lines failure", async () => {
    getMock.mockResolvedValue(ipc());
    getEntryMock.mockRejectedValue(new ApiError({ code: "SERVER_ERROR", message: "Boom", details: null, status: 500 }));
    renderWith(<IpcViewer ipcId="ipc-7" />);
    expect(await screen.findByTestId("ipc-lines-error")).toBeInTheDocument();
    expect(screen.getByTestId("ipc-lines-retry")).toBeInTheDocument();
  });
});

describe("IpcViewer — 404 / other error (spec §6)", () => {
  it("renders the 'IPC not found' state on 404", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "gone", details: null, status: 404 }));
    renderWith(<IpcViewer ipcId="ipc-missing" />);
    expect(await screen.findByTestId("ipc-not-found")).toHaveTextContent("IPC not found");
  });

  it("renders the 403 state (whole IPC out of scope)", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }));
    renderWith(<IpcViewer ipcId="ipc-cross" />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("ipc-forbidden")).toHaveTextContent("don't have access");
  });

  it("redirects a DRAFT id to the editor", async () => {
    getMock.mockResolvedValue(ipc({ status: "DRAFT", entryNo: null, journalEntryId: null }));
    renderWith(<IpcViewer ipcId="ipc-7" />);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/sales/ipcs/ipc-7"));
  });
});

describe("MushakPrintPreview — states (FR-SAL-024, Open items 2/3)", () => {
  it("renders the Mushak legal number, company + party identifiers, currently-due", async () => {
    getMock.mockResolvedValue(ipc());
    getCompanyMock.mockResolvedValue({ id: "c1", name: "Zakir Enterprise", legalName: null, bin: "004123456-0203", tin: "512345678901", address: "House 42, Road 11, Banani, Dhaka-1213, Bangladesh" });
    getPartyMock.mockResolvedValue({ id: "pa-8", name: "সড়ক ও জনপথ অধিদপ্তর", bin: null, tin: "187654321098", address: "সড়ক ভবন" });
    renderWith(<MushakPrintPreviewScreen ipcId="ipc-7" />);
    await screen.findByTestId("mushak-legal-no");
    expect(screen.getByTestId("mushak-legal-no")).toHaveTextContent("IPC/2526/0007");
    expect(screen.getByTestId("mushak-company-bin")).toHaveTextContent("004123456-0203");
    expect(screen.getByTestId("mushak-customer-tin")).toHaveTextContent("187654321098");
    // Bangla customer name never truncated.
    expect(screen.getByTestId("mushak-customer-name").textContent).toContain("অধিদপ্তর");
    // Currently-due (net payable) block.
    // Platform-wide western grouping (deviation from the design's Bangla-lakh) — see the board's standing note.
    expect(screen.getByTestId("mushak-currently-due")).toHaveTextContent("775,000.0000");
  });

  it("shows 'Not on file' for a missing customer BIN (never fabricates it on the document)", async () => {
    getMock.mockResolvedValue(ipc());
    getCompanyMock.mockResolvedValue({ id: "c1", name: "Zakir Enterprise", legalName: null, bin: "004123456-0203", tin: "512345678901", address: "..." });
    getPartyMock.mockResolvedValue({ id: "pa-8", name: "Customer", bin: null, tin: "187654321098", address: "..." });
    renderWith(<MushakPrintPreviewScreen ipcId="ipc-7" />);
    const bin = await screen.findByTestId("mushak-customer-bin");
    expect(bin).toHaveTextContent("Not on file");
  });

  it("shows a diagonal 'Cancelled' watermark + reference-only caption on a CANCELLED IPC", async () => {
    getMock.mockResolvedValue(ipc({ status: "CANCELLED" }));
    getCompanyMock.mockResolvedValue({ id: "c1", name: "Zakir Enterprise", legalName: null, bin: null, tin: null, address: "..." });
    getPartyMock.mockResolvedValue({ id: "pa-8", name: "Customer", bin: null, tin: null, address: "..." });
    renderWith(<MushakPrintPreviewScreen ipcId="ipc-7" />);
    expect(await screen.findByTestId("mushak-cancelled-caption")).toHaveTextContent(/reference only|not a valid tax invoice/i);
  });

  it("renders the 'Couldn't generate the IPC document.' + Retry state when the IPC read fails", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "SERVER_ERROR", message: "boom", details: null, status: 500 }));
    renderWith(<MushakPrintPreviewScreen ipcId="ipc-7" />);
    expect(await screen.findByTestId("mushak-retry")).toBeInTheDocument();
  });
});
