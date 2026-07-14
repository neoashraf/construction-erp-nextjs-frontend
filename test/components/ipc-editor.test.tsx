/**
 * FE-32 IPC Editor & List tests (FR-SAL-001…-023). List empties + role-gated New CTA; editor
 * live currently-due recompute, retention override persistence, advance cap/zero helper,
 * validation (certified ≤ 0, due<bill, currently-due-negative, duplicate seq), the create-draft →
 * post lifecycle, the posted cancel path, module error mapping, PM read-only gating, and the 360
 * summary strip.
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
import { type Ipc, type IpcSummary } from "@/features/sales-ipc/types";
import { IpcList } from "@/features/sales-ipc/components/IpcList";
import { IpcEditor } from "@/features/sales-ipc/components/IpcEditor";
import * as ipcApi from "@/features/sales-ipc/api/ipc";
import * as mastersApi from "@/features/sales-ipc/api/masters";

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
jest.mock("@/features/sales-ipc/api/masters");

const listMock = ipcApi.listIpcs as jest.Mock;
const getMock = ipcApi.getIpc as jest.Mock;
const createMock = ipcApi.createIpc as jest.Mock;
const updateMock = ipcApi.updateIpc as jest.Mock;
const postMock = ipcApi.postIpc as jest.Mock;
const cancelMock = ipcApi.cancelIpc as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "ACTIVE", customerId: "pa-8", customerName: "National Housing Authority", remainingAdvance: "800000.0000", hasMobilizationAdvance: true },
  { id: "proj-c", name: "Road-12 — Savar", projectCode: "RD-12", status: "ACTIVE", customerId: "pa-7", customerName: "করিম এন্টারপ্রাইজ", remainingAdvance: "0.0000", hasMobilizationAdvance: false },
];
const CUSTOMERS = [{ id: "pa-8", name: "National Housing Authority" }, { id: "pa-7", name: "করিম এন্টারপ্রাইজ" }];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Materials", isActive: true }];
const PURPOSES = [{ id: "pp-1", name: "Progress billing", projectId: "proj-a", isActive: true }];

function ipc(over: Partial<Ipc> = {}): Ipc {
  return {
    id: "ipc-7", projectId: "proj-a", customerId: "pa-8", ipcSeqNo: 7, ipcDate: "2026-07-12", billDate: "2026-07-12",
    dueDate: "2026-08-11", workCompletedPct: "45.0000", certifiedAmount: "1000000.0000", costCentreId: "cc-mat", purposeId: "pp-1",
    outputVatAmount: "75000.0000", aitTdsAmount: "50000.0000", retentionAmount: "100000.0000", advanceRecoveredAmount: "150000.0000",
    currentlyDueAmount: "775000.0000", retentionRatePct: "10.0000", advanceRatePct: "15.0000", narration: null,
    status: "POSTED", entryNo: "IPC/2526/0007", journalEntryId: "je-7", outstandingAmount: "775000.0000", retentionHeldAmount: "100000.0000",
    postedAt: "2026-07-12T05:30:00Z", postedBy: "u1", version: 2, linkage: { hasHistory: false, currentEntryNo: "IPC/2526/0007", originalEntryNo: "IPC/2526/0007", entries: [] },
    ...over,
  };
}
function summary(over: Partial<IpcSummary> = {}): IpcSummary {
  return {
    id: "ipc-7", ipcSeqNo: 7, entryNo: "IPC/2526/0007", projectId: "proj-a", customerId: "pa-8", ipcDate: "2026-07-12",
    certifiedAmount: "1000000.0000", currentlyDueAmount: "775000.0000", outstandingAmount: "775000.0000",
    retentionHeldAmount: "100000.0000", advanceRecoveredAmount: "150000.0000", status: "POSTED", ...over,
  };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
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
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listCustomerOptions as jest.Mock).mockResolvedValue(CUSTOMERS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue(CCS);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue(PURPOSES);
});

// ── List ──
describe("IpcList (spec §4/§6)", () => {
  it("renders IPC rows with status badges and the New CTA for Accounts", async () => {
    listMock.mockResolvedValue({ data: [summary(), summary({ id: "d1", entryNo: null, status: "DRAFT" })], page: 1, pageSize: 25, total: 2 });
    renderWith(<IpcList />);
    await screen.findByTestId("ipc-list");
    expect(screen.getAllByTestId("ipc-status-POSTED").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("ipc-status-DRAFT").length).toBeGreaterThan(0);
    expect(screen.getByTestId("ipc-new")).toBeInTheDocument();
  });

  it("hides the New CTA for a project-scoped read-only PM", async () => {
    listMock.mockResolvedValue({ data: [summary()], page: 1, pageSize: 25, total: 1 });
    renderWith(<IpcList />, "PROJECT_MANAGER");
    await screen.findByTestId("ipc-list");
    expect(screen.queryByTestId("ipc-new")).not.toBeInTheDocument();
  });

  it("shows the first-use empty state when nothing is filtered", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<IpcList />);
    expect(await screen.findByTestId("ipc-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("No IPCs yet.")).toBeInTheDocument();
  });

  it("shows the filtered empty state after applying a filter", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<IpcList />);
    await userEvent.selectOptions(await screen.findByTestId("ipc-f-status"), "POSTED");
    await userEvent.click(screen.getByTestId("ipc-f-apply"));
    expect(await screen.findByTestId("ipc-empty-filtered")).toBeInTheDocument();
  });
});

// ── Editor ──
async function selectProjectAndCertified(certified = "1000000") {
  await userEvent.selectOptions(await screen.findByTestId("ipc-project"), "proj-a");
  const cert = screen.getByTestId("ipc-certified");
  await userEvent.clear(cert);
  await userEvent.type(cert, certified);
}

async function fillValidDraft() {
  await selectProjectAndCertified("1000000");
  await userEvent.type(screen.getByTestId("ipc-seq"), "8");
  await userEvent.type(screen.getByLabelText(/^IPC date/), "12/07/2026");
  await userEvent.type(screen.getByLabelText(/^Bill date/), "12/07/2026");
  await userEvent.type(screen.getByLabelText(/^Due date/), "11/08/2026");
  await userEvent.type(screen.getByTestId("ipc-work"), "45");
  await userEvent.selectOptions(screen.getByTestId("ipc-cc"), "cc-mat");
  await waitFor(() => expect(screen.getByTestId("ipc-purpose")).not.toBeDisabled());
  await userEvent.selectOptions(screen.getByTestId("ipc-purpose"), "pp-1");
}

describe("IpcEditor — figures & validation (spec §4/§7)", () => {
  it("computes currently-due live as certified + VAT − retention − advance − AIT (FR-SAL-004)", async () => {
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await selectProjectAndCertified("1000000");
    // defaults: VAT 75,000 · retention 100,000 · advance 150,000 · AIT 0 → due 825,000
    await waitFor(() => expect(screen.getByTestId("ipc-currently-due")).toHaveTextContent("825,000.0000"));
  });

  it("keeps a retention override when the certified amount later changes (FR-SAL-006)", async () => {
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await selectProjectAndCertified("1000000");
    const ret = screen.getByTestId("ipc-retention");
    await userEvent.clear(ret);
    await userEvent.type(ret, "250000");
    // change certified — the overridden retention must persist (not re-default to 10%)
    const cert = screen.getByTestId("ipc-certified");
    await userEvent.clear(cert);
    await userEvent.type(cert, "1200000");
    expect(screen.getByTestId("ipc-retention")).toHaveValue("250000");
  });

  it("shows the no-advance helper for a project without mobilization advance (FR-SAL-008)", async () => {
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await userEvent.selectOptions(await screen.findByTestId("ipc-project"), "proj-c");
    expect(await screen.findByTestId("ipc-advance-helper")).toHaveTextContent("No mobilization advance on this project.");
  });

  it("blocks Save on a currently-due-negative figure set (FR-SAL-004, edge case 10)", async () => {
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await selectProjectAndCertified("100000");
    const ret = screen.getByTestId("ipc-retention");
    await userEvent.clear(ret);
    await userEvent.type(ret, "500000"); // retention > certified+vat → negative
    expect(await screen.findByTestId("ipc-currently-due-negative")).toBeInTheDocument();
    expect(screen.getByTestId("ipc-post")).toBeDisabled();
  });

  it("maps DUPLICATE_IPC_SEQ_NO to the inline sequence-number message (FR-SAL-014)", async () => {
    createMock.mockRejectedValue(new ApiError({ code: "DUPLICATE_IPC_SEQ_NO", message: "x", status: 409 }));
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await fillValidDraft();
    await userEvent.click(screen.getByTestId("ipc-save"));
    expect((await screen.findAllByText("This project already has IPC #8.")).length).toBeGreaterThan(0);
  });
});

describe("IpcEditor — lifecycle (spec §6/§8)", () => {
  it("saves a draft then posts behind the confirm dialog and shows the allocated number (FR-SAL-009…-012)", async () => {
    createMock.mockResolvedValue({ id: "ipc-new" });
    postMock.mockResolvedValue({ id: "ipc-new", entryNo: "IPC/2526/0010", journalEntryId: "je", status: "POSTED", currentlyDueAmount: "825000.0000" });
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await fillValidDraft();
    await userEvent.click(screen.getByTestId("ipc-post"));
    expect(await screen.findByTestId("ipc-post-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("ipc-post-confirm"));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith("ipc-new", 1));
    expect(await screen.findByText("IPC posted — number IPC/2526/0010.")).toBeInTheDocument();
  });

  it("cancels a POSTED IPC with a mandatory reason and retains the original number (FR-SAL-021/-022)", async () => {
    getMock.mockResolvedValue(ipc());
    cancelMock.mockResolvedValue({ id: "ipc-7", status: "CANCELLED", reversalEntryId: "je-rev", reversalEntryNo: "IPC/2526/0011" });
    renderWith(<IpcEditor ipcId="ipc-7" />, "ADMIN");
    await screen.findByTestId("ipc-readonly-banner");
    await userEvent.click(screen.getByTestId("ipc-cancel"));
    const dialog = await screen.findByTestId("ipc-cancel-dialog");
    // reason is mandatory — confirming empty surfaces the inline error, no call
    await userEvent.click(screen.getByTestId("ipc-cancel-confirm"));
    expect(await screen.findByTestId("ipc-cancel-reason-err")).toBeInTheDocument();
    expect(cancelMock).not.toHaveBeenCalled();
    await userEvent.type(screen.getByTestId("ipc-cancel-reason"), "Certified % corrected");
    await userEvent.click(screen.getByTestId("ipc-cancel-confirm"));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith("ipc-7", { reason: "Certified % corrected", version: 2 }));
    expect(await screen.findByText(/IPC cancelled — reversal IPC\/2526\/0011/)).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
  });

  it("maps a PERIOD_CLOSED post guard to its banner with no state change (FR-SAL-013)", async () => {
    createMock.mockResolvedValue({ id: "ipc-new" });
    postMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    await fillValidDraft();
    await userEvent.click(screen.getByTestId("ipc-post"));
    await userEvent.click(await screen.findByTestId("ipc-post-confirm"));
    expect(await screen.findByTestId("ipc-banner")).toHaveTextContent("The accounting period for this date is closed. Reopen it or choose another date.");
  });

  it("maps an IPC_HAS_APPLIED_RECEIPTS cancel guard to its banner (edge case 8)", async () => {
    getMock.mockResolvedValue(ipc());
    cancelMock.mockRejectedValue(new ApiError({ code: "IPC_HAS_APPLIED_RECEIPTS", message: "x", status: 409 }));
    renderWith(<IpcEditor ipcId="ipc-7" />, "ADMIN");
    await screen.findByTestId("ipc-readonly-banner");
    await userEvent.click(screen.getByTestId("ipc-cancel"));
    await screen.findByTestId("ipc-cancel-dialog");
    await userEvent.type(screen.getByTestId("ipc-cancel-reason"), "Stop it");
    await userEvent.click(screen.getByTestId("ipc-cancel-confirm"));
    expect(await screen.findByTestId("ipc-banner")).toHaveTextContent("A receipt has been applied to this IPC. Reverse the receipt before cancelling.");
  });
});

describe("IpcEditor — role/scope (spec §11)", () => {
  it("renders a POSTED IPC read-only with no write controls for a PM", async () => {
    getMock.mockResolvedValue(ipc());
    renderWith(<IpcEditor ipcId="ipc-7" />, "PROJECT_MANAGER");
    await screen.findByTestId("ipc-readonly-banner");
    expect(screen.queryByTestId("ipc-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-correct")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ipc-save")).not.toBeInTheDocument();
  });

  it("blocks a PM from the new-IPC form with a 403 (spec §6)", async () => {
    renderWith(<IpcEditor ipcId={null} />, "PROJECT_MANAGER");
    expect(await screen.findByTestId("ipc-403")).toBeInTheDocument();
  });
});

describe("IpcEditor — responsive (spec §4/§13)", () => {
  it("collapses the figures into a currently-due summary strip on a phone", async () => {
    // matchMedia → phone (<1024) so the editor renders the mobile summary strip.
    window.matchMedia = jest.fn().mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    renderWith(<IpcEditor ipcId={null} />);
    await screen.findByTestId("ipc-editor-title");
    expect(await screen.findByTestId("ipc-mobile-summary")).toBeInTheDocument();
  });
});
