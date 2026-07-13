/**
 * FE-33 IPC register + Retention panel tests (FR-SAL-015…-020, spec §5/§6/§7/§8/§10/§11).
 * Register default + both empty variants (Accounts vs PM), partial "Receipts pending sync",
 * the release happy path (dialog → post → panel + register refresh), over-release +
 * period-closed error mapping, gross-vs-net labelling (Open item 2), PM no-Release-button
 * gating, FY filter re-fetch. One Playwright happy path lives at test/e2e/ipc-register.spec.ts.
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
import { type IpcRegister, type RetentionRelease } from "@/features/sales-ipc/types";
import { IpcRegisterScreen } from "@/features/sales-ipc/components/IpcRegisterScreen";
import * as registerApi from "@/features/sales-ipc/api/ipc-register";
import * as mastersApi from "@/features/sales-ipc/api/masters";

const routerReplace = jest.fn();
const routerPush = jest.fn();
const searchParamsGet = jest.fn<string | null, [string]>();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn() }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/sales-ipc/api/ipc-register");
jest.mock("@/features/sales-ipc/api/masters");

const registerMock = registerApi.getIpcRegister as jest.Mock;
const releaseMock = registerApi.releaseRetention as jest.Mock;
const listReleasesMock = registerApi.listRetentionReleases as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "ACTIVE", customerId: "pa-8", customerName: "National Housing Authority", remainingAdvance: "800000.0000", hasMobilizationAdvance: true },
  { id: "proj-b", name: "Tower-A — Gulshan", projectCode: "TW-A", status: "ACTIVE", customerId: "pa-4", customerName: "Tower-A Developments Ltd.", remainingAdvance: "5000000.0000", hasMobilizationAdvance: true },
];
const FYS = [{ id: "fy-2526", label: "FY 2025–26" }, { id: "fy-2425", label: "FY 2024–25" }];

function registerData(over: Partial<IpcRegister> = {}): IpcRegister {
  return {
    rows: [
      {
        ipcId: "ipc-5", ipcSeqNo: 5, ipcDate: "2026-06-28", entryNo: "IPC/2526/0005",
        certifiedAmount: "800000.0000", currentlyDueAmount: "620000.0000",
        retentionAmount: "80000.0000", advanceRecoveredAmount: "120000.0000",
        receivedAmount: "0.0000", outstandingAmount: "620000.0000",
        cumCertified: "800000.0000", cumBilledDue: "620000.0000", cumRetainedHeld: "80000.0000",
        cumAdvanceRecovered: "120000.0000", cumReceived: "0.0000",
      },
      {
        ipcId: "ipc-7", ipcSeqNo: 7, ipcDate: "2026-07-12", entryNo: "IPC/2526/0007",
        certifiedAmount: "1000000.0000", currentlyDueAmount: "775000.0000",
        retentionAmount: "100000.0000", advanceRecoveredAmount: "150000.0000",
        receivedAmount: null, outstandingAmount: "775000.0000",
        cumCertified: "1800000.0000", cumBilledDue: "1395000.0000", cumRetainedHeld: "180000.0000",
        cumAdvanceRecovered: "270000.0000", cumReceived: null,
      },
    ],
    totals: {
      certified: "1800000.0000",
      billedDue: "1395000.0000",
      retainedHeld: "180000.0000",
      advanceRecovered: "270000.0000",
      received: "0.0000",
      outstanding: "1395000.0000",
    },
    ...over,
  };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(role: Role = "ACCOUNTS_MANAGER", projectId: string | null = "proj-a") {
  searchParamsGet.mockImplementation((k) => (k === "projectId" ? projectId : null));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <IpcRegisterScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listFinancialYearOptions as jest.Mock).mockResolvedValue(FYS);
  registerMock.mockResolvedValue(registerData());
  listReleasesMock.mockResolvedValue([]);
});

describe("IpcRegisterScreen — register (spec §5/§6)", () => {
  it("renders per-IPC rows + pinned totals row + read-only chip (FR-SAL-015)", async () => {
    renderWith();
    await screen.findByTestId("reg-grid");
    expect(screen.getByTestId("reg-row-ipc-5")).toBeInTheDocument();
    expect(screen.getByTestId("reg-row-ipc-7")).toBeInTheDocument();
    // Pinned totals row is present + aria-labelled "Totals" (a11y §10)
    const totals = screen.getByTestId("reg-totals");
    expect(totals).toHaveAttribute("aria-label", "Totals");
    expect(totals).toHaveTextContent("1,395,000.00"); // billedDue
    expect(screen.getByText("Read / derived view")).toBeInTheDocument();
  });

  it("surfaces the 'Receipts pending sync' partial state when receivedAmount is null (spec §6)", async () => {
    renderWith();
    await screen.findByTestId("reg-grid");
    // ipc-7 has receivedAmount=null → pending sync pill
    expect(screen.getByTestId("reg-received-pending")).toBeInTheDocument();
  });

  it("labels the register's cumulative retained column '(gross)' distinct from the panel's held (Open item 2)", async () => {
    renderWith();
    await screen.findByTestId("reg-grid");
    // Cumulative-retained (gross) column header — the register's running sum of gross
    expect(screen.getByText(/Cum retained \(gross\)/)).toBeInTheDocument();
    // Retention panel's headline is labelled "Retention held" (net)
    expect(screen.getByTestId("retention-total-held")).toHaveTextContent(/Retention held/);
  });

  it("shows the 'select a project' state before a project is chosen", async () => {
    renderWith("ACCOUNTS_MANAGER", null);
    expect(await screen.findByText("Select a project")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("shows the empty-register state + a 'New IPC' CTA for Accounts (spec §6)", async () => {
    registerMock.mockResolvedValueOnce({ rows: [], totals: { certified: "0.0000", billedDue: "0.0000", retainedHeld: "0.0000", advanceRecovered: "0.0000", received: "0.0000", outstanding: "0.0000" } });
    renderWith();
    expect(await screen.findByTestId("reg-empty")).toBeInTheDocument();
    expect(screen.getByTestId("reg-empty-new")).toBeInTheDocument();
  });

  it("hides the 'New IPC' CTA for a Project Manager (spec §11 read-only)", async () => {
    registerMock.mockResolvedValueOnce({ rows: [], totals: { certified: "0.0000", billedDue: "0.0000", retainedHeld: "0.0000", advanceRecovered: "0.0000", received: "0.0000", outstanding: "0.0000" } });
    renderWith("PROJECT_MANAGER");
    expect(await screen.findByTestId("reg-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("reg-empty-new")).not.toBeInTheDocument();
  });

  it("renders a 403 permission-denied view for a PM opening an unassigned project (spec §11)", async () => {
    registerMock.mockRejectedValueOnce(new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }));
    renderWith("PROJECT_MANAGER");
    expect(await screen.findByText("You don't have access to this project's register.")).toBeInTheDocument();
  });

  it("re-fetches when the financial-year filter changes (spec §9)", async () => {
    renderWith();
    await screen.findByTestId("reg-grid");
    expect(registerMock).toHaveBeenCalledWith("proj-a", undefined);
    await userEvent.selectOptions(screen.getByTestId("reg-f-fy"), "fy-2526");
    await waitFor(() => expect(registerMock).toHaveBeenCalledWith("proj-a", "fy-2526"));
  });
});

describe("Retention panel + Release-retention dialog (spec §5/§6/§7/§8)", () => {
  it("shows headline held (net) + released and per-IPC breakdown rows (FR-SAL-018)", async () => {
    renderWith();
    await screen.findByTestId("reg-grid");
    expect(screen.getByTestId("retention-total-held")).toHaveTextContent("180,000.00");
    // Two rows both with retentionAmount > 0
    expect(screen.getByTestId("ret-row-ipc-5")).toBeInTheDocument();
    expect(screen.getByTestId("ret-row-ipc-7")).toBeInTheDocument();
  });

  it("hides the Release button entirely for a PM (spec §11 'no Release button rendered')", async () => {
    renderWith("PROJECT_MANAGER");
    await screen.findByTestId("retention-panel");
    expect(screen.queryByTestId("ret-release-btn-ipc-5")).not.toBeInTheDocument();
  });

  it("release happy path: dialog → confirm → panel + register invalidated + toast (FR-SAL-018/-020)", async () => {
    releaseMock.mockResolvedValueOnce({ id: "rel-1", ipcId: "ipc-5", entryNo: "IPC/2526/0011", releasedAmount: "80000.0000", status: "POSTED" });
    renderWith();
    await screen.findByTestId("reg-grid");
    await userEvent.click(await screen.findByTestId("ret-release-btn-ipc-5"));
    await screen.findByTestId("release-dialog");
    await userEvent.type(screen.getByLabelText(/Release date/), "20/06/2027");
    await userEvent.click(screen.getByTestId("release-continue"));
    expect(await screen.findByTestId("release-confirm-title")).toHaveTextContent(/Release .* for IPC #5/);
    await userEvent.click(screen.getByTestId("release-confirm"));
    await waitFor(() => expect(releaseMock).toHaveBeenCalledWith(
      "ipc-5",
      expect.objectContaining({ releaseDate: "2027-06-20" }),
    ));
    expect(await screen.findByText(/Retention released — ৳80,000.00 moved to currently-due \(number IPC\/2526\/0011\)/)).toBeInTheDocument();
  });

  it("maps OVER_RELEASE to the exact spec §8 inline message + keeps the dialog open (FR-SAL-019)", async () => {
    releaseMock.mockRejectedValueOnce(new ApiError({ code: "OVER_RELEASE", message: "over", details: null, status: 409 }));
    renderWith();
    await screen.findByTestId("reg-grid");
    await userEvent.click(await screen.findByTestId("ret-release-btn-ipc-5"));
    await screen.findByTestId("release-dialog");
    await userEvent.type(screen.getByLabelText(/Release date/), "20/06/2027");
    await userEvent.type(screen.getByTestId("release-amount"), "70000");
    await userEvent.click(screen.getByTestId("release-continue"));
    await userEvent.click(await screen.findByTestId("release-confirm"));
    expect(await screen.findByTestId("release-amount-err")).toHaveTextContent(/You can't release more than the retention held \(৳80000.0000\)/);
    expect(screen.getByTestId("release-dialog")).toBeInTheDocument();
  });

  it("maps PERIOD_CLOSED to the banner and keeps entered values (edge case 13)", async () => {
    releaseMock.mockRejectedValueOnce(new ApiError({ code: "PERIOD_CLOSED", message: "closed", details: null, status: 409 }));
    renderWith();
    await screen.findByTestId("reg-grid");
    await userEvent.click(await screen.findByTestId("ret-release-btn-ipc-5"));
    await screen.findByTestId("release-dialog");
    await userEvent.type(screen.getByLabelText(/Release date/), "20/06/2027");
    await userEvent.click(screen.getByTestId("release-continue"));
    await userEvent.click(await screen.findByTestId("release-confirm"));
    // banner replaces confirm-mode content but keeps dialog open (the user is dropped back to confirm step)
    expect(await screen.findByTestId("release-banner")).toHaveTextContent(/This accounting period is closed — release isn't allowed/);
    expect(screen.getByTestId("release-dialog")).toBeInTheDocument();
  });

  it("loads the per-IPC releases audit list on expansion (FR-SAL-018)", async () => {
    const releases: RetentionRelease[] = [{
      id: "rel-1", releaseDate: "2027-01-05", releasedAmount: "40000.0000", entryNo: "IPC/2526/0010",
      status: "POSTED", postedAt: "2027-01-05T05:30:00Z", postedBy: "u1",
    }];
    listReleasesMock.mockResolvedValue(releases);
    renderWith();
    await screen.findByTestId("reg-grid");
    await userEvent.click(screen.getByTestId("ret-row-toggle-ipc-5"));
    await screen.findByTestId("releases-list-ipc-5");
    expect(screen.getByTestId("release-rel-1")).toHaveTextContent("IPC/2526/0010");
  });

  it("surfaces a per-IPC releases-list fetch failure inline with a retry (spec §6 partial)", async () => {
    listReleasesMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }));
    renderWith();
    await screen.findByTestId("reg-grid");
    await userEvent.click(screen.getByTestId("ret-row-toggle-ipc-7"));
    expect(await screen.findByTestId("releases-error-ipc-7")).toBeInTheDocument();
    expect(screen.getByTestId("releases-retry-ipc-7")).toBeInTheDocument();
  });
});
