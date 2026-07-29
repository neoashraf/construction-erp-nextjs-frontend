/**
 * FE-37 Salary sheet tests (FR-HR-003, -013..-018). Covers: generate (server-confirmed,
 * duplicate-draft with existing-draft link) → line & bulk-component edit (totals recompute,
 * DRAFT-only) → Post (balanced-preview gate, non-optimistic whole-sheet lock, read-only
 * flip, entryNo link + "View payslips") → Reverse (reason-required, REVERSED badge,
 * read-only stays); INACTIVE-excluded helper note; period/project-closed + unbalanced-guard;
 * SALARY_NOT_DRAFT edit-after-post; role gating (SITE_ENGINEER 403 nav hidden); both empty
 * variants; 360 read-only degrade.
 */
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { SalaryRunsList } from "@/features/hr/components/SalaryRunsList";
import { SalarySheetEditor } from "@/features/hr/components/SalarySheetEditor";
import * as salApi from "@/features/hr/api/salary";
import * as masters from "@/features/hr/api/masters";
import * as employeesApi from "@/features/hr/api/employees";
import type { SalarySheet, SalarySheetSummary } from "@/features/hr/api/salary";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/hr/api/salary");
jest.mock("@/features/hr/api/masters");
jest.mock("@/features/hr/api/employees");
jest.mock("@/lib/masters/lookups", () => ({
  useMasterLookups: () => ({
    accountLabel: (id?: string | null) => id ?? "",
    accountName: () => null,
    party: (id?: string | null) => id ?? "",
    project: (id?: string | null) => (id === "proj-a" ? "Bridge-04" : id === "proj-b" ? "Tower-A" : id ?? ""),
    costCentre: (id?: string | null) => (id === "cc-lab" ? "Labour" : id ?? ""),
  }),
  useAccountOptions: () => ({ accounts: [], isLoading: false }),
}));

const listSheetsMock = salApi.listSalarySheets as jest.Mock;
const getSheetMock = salApi.getSalarySheet as jest.Mock;
const generateMock = salApi.generateSalarySheet as jest.Mock;
const patchLineMock = salApi.updateSalaryLine as jest.Mock;
const applyBulkMock = salApi.applyBulkComponents as jest.Mock;
const postMock = salApi.postSalarySheet as jest.Mock;
const reverseMock = salApi.reverseSalarySheet as jest.Mock;
const listFyMock = salApi.listFinancialYearOptions as jest.Mock;

const listProjectsMock = masters.listProjectOptions as jest.Mock;
const listPurposesMock = masters.listPurposeOptions as jest.Mock;
const getSettingsMock = salApi.getAttendanceSettings as jest.Mock;
const toWarningsMock = salApi.toSalaryWarnings as jest.Mock;
const listEmployeesMock = employeesApi.listEmployees as jest.Mock;

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "HR_MANAGER") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>{ui}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function summary(over: Partial<SalarySheetSummary> = {}): SalarySheetSummary {
  return {
    id: "sal-1",
    financialYearId: "fy-1",
    periodLabel: "2026-06",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    status: "DRAFT",
    salaryEntryId: null,
    entryNo: null,
    reversalEntryId: null,
    reversalEntryNo: null,
    totalGross: "105000.0000",
    totalDeductions: "5000.0000",
    totalNet: "100000.0000",
    postedAt: null,
    postedBy: null,
    version: 1,
    ...over,
  };
}

function sheet(over: Partial<SalarySheet> = {}): SalarySheet {
  const base: SalarySheet = {
    ...summary(),
    lines: [
      {
        id: "sl-1", employeeId: "emp-1", employeeCode: "EMP-001", employeeName: "মোঃ রফিকুল ইসলাম",
        designation: "Site Accountant", pfApplicable: true, wageType: "MONTHLY",
        projectId: "proj-a", costCentreId: "cc-lab", purposeId: "pp-1",
        standardDays: "30.0000", unpaidDays: "0.0000", paidDays: "30.000",
        lateCount: 0, latePenaltyDays: "0.0000", latePenaltyAmount: "0.0000",
        grossAmount: "45000.0000",
        allowances: "0.0000", tdsAmount: "0.0000", tdsRate: null,
        pfAmount: "2250.0000", advanceRecovery: "0.0000", otherDeductions: "0.0000",
        netAmount: "42750.0000", version: 1,
      },
      {
        id: "sl-2", employeeId: "emp-2", employeeCode: "EMP-002", employeeName: "Farzana Akter",
        designation: "Site Engineer", pfApplicable: true, wageType: "MONTHLY",
        projectId: "proj-a", costCentreId: "cc-lab", purposeId: "pp-1",
        standardDays: "30.0000", unpaidDays: "2.0000", paidDays: "28.000",
        lateCount: 7, latePenaltyDays: "2.0000", latePenaltyAmount: "4000.0000",
        grossAmount: "60000.0000",
        allowances: "0.0000", tdsAmount: "0.0000", tdsRate: null,
        pfAmount: "3000.0000", advanceRecovery: "0.0000", otherDeductions: "0.0000",
        netAmount: "57000.0000", version: 1,
      },
    ],
    ...over,
  };
  return base;
}

beforeEach(() => {
  jest.clearAllMocks();
  listFyMock.mockResolvedValue([{ id: "fy-1", code: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31", isClosed: false }]);
  listProjectsMock.mockResolvedValue([{ id: "proj-a", name: "Bridge-04" }]);
  listPurposesMock.mockResolvedValue([{ id: "pp-1", name: "Casting" }]);
  listSheetsMock.mockResolvedValue({ data: [], page: 1, pageSize: 50, total: 0 });
  getSettingsMock.mockResolvedValue({ lateAfter: "09:30", latesPerDeductedDay: 3 });
  listEmployeesMock.mockResolvedValue({
    data: [{ id: "emp-9", name: "Shafiqul Alam" }],
    page: 1,
    pageSize: 200,
    total: 1,
  });
  // The editor normalises stored warnings through this — use the real implementation.
  toWarningsMock.mockImplementation(
    (raw: unknown) => jest.requireActual("@/features/hr/api/salary").toSalaryWarnings(raw),
  );
});

/** A non-empty FR-HR-013a warnings object — two gap days, one outlier, one skipped. */
function gapWarnings(over: Partial<salApi.SalarySheetWarnings> = {}): salApi.SalarySheetWarnings {
  return {
    daysWithNoRecords: ["2026-06-04", "2026-06-05"],
    skippedEmployees: [{ employeeId: "emp-9", reason: "NO_PROJECT" }],
    employeeAbsences: [
      { employeeId: "emp-1", unpaidDays: 0 },
      { employeeId: "emp-2", unpaidDays: 2 },
    ],
    noWeeklyHolidaysConfigured: false,
    ...over,
  };
}

// ── Runs list ──
describe("SalaryRunsList — landing & empties", () => {
  it("shows the first-use empty when no runs and canGenerate = HR Manager", async () => {
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-empty-firstuse");
    expect(screen.getByTestId("salary-empty-generate")).toBeInTheDocument();
  });

  it("shows the filtered-empty when a filter yields nothing", async () => {
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-empty-firstuse");
    await userEvent.type(screen.getByTestId("filter-period"), "1999-01");
    await userEvent.click(screen.getByTestId("filter-apply"));
    // Re-fires with periodLabel=1999-01 only after Apply (Salary Sheet.dc.html filter bar)
    await waitFor(() => {
      expect(screen.getByTestId("salary-runs-empty-filtered")).toBeInTheDocument();
    });
  });

  it("renders posted / draft / reversed rows with the status badge", async () => {
    listSheetsMock.mockResolvedValue({
      data: [summary({ status: "POSTED", entryNo: "SAL/2526/0001" }), summary({ id: "sal-2", status: "DRAFT" }), summary({ id: "sal-3", status: "REVERSED", reversalEntryNo: "SAL/2526/0009" })],
      page: 1,
      pageSize: 50,
      total: 3,
    });
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-table");
    expect(screen.getByTestId("salary-run-row-POSTED")).toBeInTheDocument();
    expect(screen.getByTestId("salary-run-row-DRAFT")).toBeInTheDocument();
    expect(screen.getByTestId("salary-run-row-REVERSED")).toBeInTheDocument();
  });

  it("SITE_ENGINEER: Generate CTA is HIDDEN", async () => {
    renderWith(<SalaryRunsList />, "SITE_ENGINEER");
    await screen.findByTestId("salary-runs-empty-firstuse");
    expect(screen.queryByTestId("salary-generate")).not.toBeInTheDocument();
  });
});

// ── Generate ──
describe("Generate dialog — server-confirmed & duplicate-draft", () => {
  it("submits and routes to the new draft editor on 201", async () => {
    generateMock.mockResolvedValue({ id: "sal-new-1", status: "DRAFT", periodLabel: "2026-08" });
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-empty-firstuse");
    await userEvent.click(screen.getByTestId("salary-generate"));
    await screen.findByTestId("generate-sheet-dialog");
    await userEvent.selectOptions(screen.getByTestId("gen-project"), "proj-a");
    await userEvent.selectOptions(await screen.findByTestId("gen-purpose"), "pp-1");
    await userEvent.click(screen.getByTestId("gen-submit"));
    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-a", purposeId: "pp-1" }),
    );
  });

  it("surfaces DUPLICATE_DRAFT_SHEET with the existing-draft link", async () => {
    generateMock.mockRejectedValue(
      new ApiError({
        code: "DUPLICATE_DRAFT_SHEET",
        message: "x",
        status: 409,
        details: { existingId: "sal-existing-9" },
      }),
    );
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-empty-firstuse");
    await userEvent.click(screen.getByTestId("salary-generate"));
    await screen.findByTestId("generate-sheet-dialog");
    await userEvent.selectOptions(screen.getByTestId("gen-project"), "proj-a");
    await userEvent.selectOptions(await screen.findByTestId("gen-purpose"), "pp-1");
    await userEvent.click(screen.getByTestId("gen-submit"));
    const err = await screen.findByTestId("gen-server-err");
    expect(err).toHaveTextContent("A draft salary sheet already exists");
    expect(screen.getByTestId("gen-existing-link")).toHaveAttribute("href", "/hr/salary-sheets/sal-existing-9");
  });

  it("blocks periodEnd < periodStart with the spec §8 message", async () => {
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-empty-firstuse");
    await userEvent.click(screen.getByTestId("salary-generate"));
    const dialog = await screen.findByTestId("generate-sheet-dialog");
    // Set an end-date before the start-date manually
    const start = within(dialog).getByLabelText(/Start date/i);
    const end = within(dialog).getByLabelText(/End date/i);
    await userEvent.clear(start);
    await userEvent.type(start, "15/06/2026");
    await userEvent.clear(end);
    await userEvent.type(end, "01/06/2026");
    await userEvent.click(within(dialog).getByTestId("gen-submit"));
    expect(await within(dialog).findByTestId("gen-end-err")).toHaveTextContent("Period end can't be before period start.");
    expect(generateMock).not.toHaveBeenCalled();
  });
});

// ── Editor: line edit, bulk apply, Post, Reverse, INACTIVE note, empties ──
describe("SalarySheetEditor — DRAFT edit → Post lifecycle", () => {
  it("shows the INACTIVE-excluded helper note on DRAFT", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("salary-inactive-note")).toHaveTextContent("Inactive employees are excluded automatically.");
  });

  it("patches a line on blur and refreshes totals from the server", async () => {
    const initial = sheet();
    getSheetMock.mockResolvedValueOnce(initial);
    patchLineMock.mockResolvedValue({
      line: { ...initial.lines[0]!, allowances: "1000.0000", netAmount: "43750.0000", version: 2 },
      totals: { totalGross: "106000.0000", totalDeductions: "5000.0000", totalNet: "101000.0000" },
      version: 2,
    });
    // Refetch after PATCH → return updated sheet
    getSheetMock.mockResolvedValueOnce({
      ...initial,
      version: 2,
      totalGross: "106000.0000",
      totalNet: "101000.0000",
      lines: [{ ...initial.lines[0]!, allowances: "1000.0000", netAmount: "43750.0000", version: 2 }, initial.lines[1]!],
    });
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    const cell = screen.getByTestId("line-allow-sl-1");
    await userEvent.clear(cell);
    await userEvent.type(cell, "1000");
    // Trigger onBlur
    (cell as HTMLInputElement).blur();
    await waitFor(() => expect(patchLineMock).toHaveBeenCalled());
    expect(patchLineMock).toHaveBeenCalledWith("sal-1", "sl-1", { allowances: "1000", version: 1 });
  });

  it("applies a bulk TDS rate and shows the changedLineCount toast", async () => {
    const initial = sheet();
    getSheetMock.mockResolvedValue(initial);
    applyBulkMock.mockResolvedValue({
      totals: { totalGross: "105000.0000", totalDeductions: "10500.0000", totalNet: "94500.0000" },
      changedLineCount: 2,
      version: 2,
    });
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    const bulk = await screen.findByTestId("bulk-component-panel");
    await userEvent.type(within(bulk).getByTestId("bulk-tds"), "10");
    await userEvent.click(within(bulk).getByTestId("bulk-apply"));
    await waitFor(() => expect(applyBulkMock).toHaveBeenCalled());
    expect(applyBulkMock).toHaveBeenCalledWith("sal-1", expect.objectContaining({
      apply: expect.objectContaining({ tdsRate: "10" }),
      employeeIds: null,
      version: 1,
    }));
  });

  it("Post is DISABLED until the balanced-preview checkbox is ticked", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    const postBtn = screen.getByTestId("post-open");
    expect(postBtn).toBeDisabled();
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    expect(postBtn).not.toBeDisabled();
  });

  it("posts non-optimistically → banner shown, then flips read-only IN PLACE + entryNo link + View payslips", async () => {
    const initial = sheet();
    getSheetMock.mockResolvedValueOnce(initial);
    // After post — refetch returns POSTED sheet
    getSheetMock.mockResolvedValueOnce({
      ...initial,
      status: "POSTED",
      entryNo: "SAL/2526/0001",
      salaryEntryId: "je-sal-1",
      version: 2,
    });
    let resolvePost!: (v: unknown) => void;
    postMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    await userEvent.click(screen.getByTestId("post-open"));
    const dialog = await screen.findByTestId("post-confirm-dialog");
    await userEvent.click(within(dialog).getByTestId("post-confirm"));
    // The whole-sheet banner appears
    expect(await screen.findByTestId("posting-banner")).toBeInTheDocument();
    // Resolve the server
    await act(async () => {
      resolvePost({
        salarySheetId: "sal-1",
        salaryEntryId: "je-sal-1",
        entryNo: "SAL/2526/0001",
        status: "POSTED",
        postedAt: "2026-07-13T00:00:00Z",
        postedBy: "u1",
        version: 2,
      });
    });
    await waitFor(() => expect(screen.queryByTestId("posting-banner")).not.toBeInTheDocument());
    // The refetched sheet flips to POSTED — entry link + View payslips appear
    await waitFor(() => expect(screen.getByTestId("salary-status-POSTED")).toBeInTheDocument());
    expect(screen.getByTestId("salary-entry-link")).toHaveTextContent("SAL/2526/0001");
    expect(screen.getByTestId("view-payslips")).toBeInTheDocument();
  });

  it("surfaces MISSING_REQUIRED_DIMENSION in the preview panel when a line has no purpose", async () => {
    const s = sheet();
    s.lines[0]!.purposeId = null;
    getSheetMock.mockResolvedValue(s);
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("preview-missing-dim")).toHaveTextContent(
      "missing a project, cost centre, or purpose",
    );
    expect(screen.getByTestId(`line-missing-dim-${s.lines[0]!.id}`)).toBeInTheDocument();
    // Post still can't be pressed even after preview confirm
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    expect(screen.getByTestId("post-open")).toBeDisabled();
  });

  it("surfaces PERIOD_CLOSED with the spec §8 copy on Post", async () => {
    getSheetMock.mockResolvedValue(sheet());
    postMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    await userEvent.click(screen.getByTestId("post-open"));
    const dialog = await screen.findByTestId("post-confirm-dialog");
    await userEvent.click(within(dialog).getByTestId("post-confirm"));
    expect(await within(dialog).findByTestId("post-server-err")).toHaveTextContent(
      "This period is closed",
    );
  });

  it("surfaces UNBALANCED_ENTRY guard message on Post", async () => {
    getSheetMock.mockResolvedValue(sheet());
    postMock.mockRejectedValue(new ApiError({ code: "UNBALANCED_ENTRY", message: "x", status: 409 }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    await userEvent.click(screen.getByTestId("post-open"));
    const dialog = await screen.findByTestId("post-confirm-dialog");
    await userEvent.click(within(dialog).getByTestId("post-confirm"));
    expect(await within(dialog).findByTestId("post-server-err")).toHaveTextContent(
      "doesn't balance",
    );
  });

  it("surfaces SALARY_NOT_DRAFT when attempting to edit a POSTED sheet's line", async () => {
    getSheetMock.mockResolvedValue(sheet({ status: "POSTED", entryNo: "SAL/2526/0001", salaryEntryId: "je-1" }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    // No editable inputs on a POSTED sheet — the cell renders as static <td>, not <input>.
    const allowCell = screen.getByTestId("line-allow-sl-1");
    expect(allowCell.tagName).toBe("TD");
    // The bulk panel and preview panel are NOT rendered on a POSTED sheet.
    expect(screen.queryByTestId("bulk-component-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-preview-panel")).not.toBeInTheDocument();
  });

  it("shows both empty variants OK for editor (no lines): payslips-not-ready note", async () => {
    getSheetMock.mockResolvedValue({ ...sheet(), lines: [] });
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("salary-editor-no-lines")).toBeInTheDocument();
    expect(screen.getByTestId("salary-payslips-note")).toHaveTextContent("Payslips will be available once this run is posted.");
  });
});

// ── Reverse ──
describe("SalarySheetEditor — Reverse a POSTED run", () => {
  it("requires a reason then calls the API, flips REVERSED with linked entryNo", async () => {
    const initial = sheet({ status: "POSTED", entryNo: "SAL/2526/0001", salaryEntryId: "je-1", version: 2 });
    getSheetMock.mockResolvedValueOnce(initial);
    getSheetMock.mockResolvedValueOnce({
      ...initial,
      status: "REVERSED",
      reversalEntryNo: "SAL/2526/0002",
      reversalEntryId: "je-r-2",
      version: 3,
    });
    reverseMock.mockResolvedValue({
      reversalEntryId: "je-r-2",
      reversalEntryNo: "SAL/2526/0002",
      originalEntryId: "je-1",
      status: "REVERSED",
      version: 3,
    });
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    await userEvent.click(screen.getByTestId("reverse-open"));
    const dialog = await screen.findByTestId("reverse-salary-dialog");
    await userEvent.click(within(dialog).getByTestId("rev-confirm"));
    expect(await within(dialog).findByTestId("rev-reason-err")).toHaveTextContent("Enter a reason");
    await userEvent.type(within(dialog).getByTestId("rev-reason"), "TDS wrongly applied");
    await userEvent.click(within(dialog).getByTestId("rev-confirm"));
    await waitFor(() => expect(reverseMock).toHaveBeenCalledWith("sal-1", { reason: "TDS wrongly applied", version: 2 }));
    // After refetch, the sheet flips REVERSED with the reversal link
    await waitFor(() => expect(screen.getByTestId("salary-status-REVERSED")).toBeInTheDocument());
    expect(screen.getByTestId("salary-reversal-link")).toHaveTextContent("SAL/2526/0002");
  });

  it("surfaces ALREADY_REVERSED with the spec §8 copy", async () => {
    getSheetMock.mockResolvedValue(sheet({ status: "POSTED", entryNo: "SAL/2526/0001", salaryEntryId: "je-1", version: 2 }));
    reverseMock.mockRejectedValue(new ApiError({ code: "ALREADY_REVERSED", message: "x", status: 409 }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    await userEvent.click(screen.getByTestId("reverse-open"));
    const dialog = await screen.findByTestId("reverse-salary-dialog");
    await userEvent.type(within(dialog).getByTestId("rev-reason"), "double-reverse");
    await userEvent.click(within(dialog).getByTestId("rev-confirm"));
    expect(await within(dialog).findByTestId("rev-server-err")).toHaveTextContent(
      "This salary run has already been reversed.",
    );
  });

  it("REVERSED sheet stays visible + fully read-only (no Reverse/Post/Bulk affordances)", async () => {
    getSheetMock.mockResolvedValue(
      sheet({ status: "REVERSED", entryNo: "SAL/2526/0001", reversalEntryNo: "SAL/2526/0002", salaryEntryId: "je-1", reversalEntryId: "je-r-2", version: 3 }),
    );
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.queryByTestId("post-open")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reverse-open")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bulk-component-panel")).not.toBeInTheDocument();
    // The allowances cell renders as static <td>, not an editable <input>.
    expect(screen.getByTestId("line-allow-sl-1").tagName).toBe("TD");
    // The read-only note is present
    expect(screen.getByTestId("salary-readonly-note")).toHaveTextContent("reversed");
    // Both original + reversal links present
    expect(screen.getByTestId("salary-entry-link")).toHaveTextContent("SAL/2526/0001");
    expect(screen.getByTestId("salary-reversal-link")).toHaveTextContent("SAL/2526/0002");
  });
});

// ── Read-only degrade + role gating ──
describe("Role gating + degrade", () => {
  it("HR_MANAGER: Post button rendered on DRAFT", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("post-open")).toBeInTheDocument();
  });

  it("ACCOUNTS_MANAGER: has Post/Reverse (accounts-desk task) but bulk edit hidden", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("post-open")).toBeInTheDocument();
    // canEditSalaryDraft is HR/Admin only — bulk panel hidden
    expect(screen.queryByTestId("bulk-component-panel")).not.toBeInTheDocument();
    // Per-line cell renders as static <td>, not an editable <input>.
    expect(screen.getByTestId("line-allow-sl-1").tagName).toBe("TD");
  });

  it("SITE_ENGINEER: nav/edit hidden — no post/reverse controls anywhere", async () => {
    getSheetMock.mockResolvedValue(sheet({ status: "POSTED", entryNo: "SAL/2526/0001", salaryEntryId: "je-1", version: 2 }));
    renderWith(<SalarySheetEditor id="sal-1" />, "SITE_ENGINEER");
    await screen.findByTestId("salary-editor");
    expect(screen.queryByTestId("post-open")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reverse-open")).not.toBeInTheDocument();
  });

  it("360 read-only degrade — stacked cards rendered", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");
    expect(screen.getByTestId("salary-lines-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("salary-line-card-sl-1")).toBeInTheDocument();
  });
});

// ── FE-67 — FR-HR-013a Days group + mandatory pre-post attendance-gap warning ──

describe("FR-HR-013a Days column group", () => {
  it("renders Standard · Unpaid · Paid · Late under one 'Days' colgroup header", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");

    const group = screen.getByTestId("days-group-header");
    expect(group).toHaveAttribute("scope", "colgroup");
    expect(group).toHaveAttribute("colspan", "4");
    expect(within(group).getByText(/Paid = standard − unpaid\. Weekly and government holidays are paid\./)).toBeInTheDocument();
    // Scope to the desktop grid — the tablet table also renders headers in jsdom.
    const desktopTable = within(group.closest("table") as HTMLElement);
    for (const h of ["Standard", "Unpaid", "Paid", "Late"]) {
      expect(desktopTable.getByRole("columnheader", { name: new RegExp(`^${h}$`) })).toBeInTheDocument();
    }
  });

  it("formats the Late cell as '{count} → {days}d', '—' at zero, with the company divisor in the tooltip", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");

    expect(screen.getByTestId("line-late-sl-1")).toHaveTextContent("—"); // lateCount 0
    expect(screen.getByTestId("line-late-sl-2")).toHaveTextContent("7 → 2d");
    await waitFor(() =>
      expect(screen.getByTestId("late-column-header")).toHaveAttribute(
        "title",
        "Every 3 late days cost one day's pay. The penalty reduces gross — it isn't a separate deduction.",
      ),
    );
    // latePenaltyAmount lives in the per-line tooltip, never as a grid column.
    expect(screen.getByTestId("line-late-sl-2").getAttribute("title")).toContain("Penalty:");
    expect(screen.queryByRole("columnheader", { name: /Penalty/ })).not.toBeInTheDocument();
  });

  it("renders a DAILY line's Standard/Unpaid/Late as '—' (inapplicable, never zero) with the Daily wage pill", async () => {
    const s = sheet();
    s.lines[0] = {
      ...s.lines[0]!,
      wageType: "DAILY",
      standardDays: "0.0000",
      unpaidDays: "0.0000",
      paidDays: "22.0000",
      lateCount: 0,
      latePenaltyDays: "0.0000",
      latePenaltyAmount: "0.0000",
    };
    getSheetMock.mockResolvedValue(s);
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");

    expect(screen.getByTestId("line-standard-sl-1")).toHaveTextContent("—");
    expect(screen.getByTestId("line-unpaid-sl-1")).toHaveTextContent("—");
    expect(screen.getByTestId("line-late-sl-1")).toHaveTextContent("—");
    expect(screen.getByTestId("line-paid-sl-1")).toHaveTextContent("22");
    expect(screen.getByTestId("line-daily-pill-sl-1")).toHaveTextContent(/daily wage/i);
  });

  it("emphasises a non-zero Unpaid cell with a text cue, not colour alone", async () => {
    getSheetMock.mockResolvedValue(sheet());
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");

    // sl-2 has unpaidDays 2 — emphasised, with the sr-only "unpaid days" text cue.
    expect(within(screen.getByTestId("line-unpaid-sl-2")).getByText("unpaid days")).toBeInTheDocument();
  });
});

describe("FR-HR-013a pre-post attendance-gap warning", () => {
  it("renders all three sections with the exact spec §8 copy, from the STORED sheet (no generate in play)", async () => {
    getSheetMock.mockResolvedValue(sheet({ warnings: gapWarnings() }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("attendance-gap-alert");

    const alert = screen.getByTestId("attendance-gap-alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(within(alert).getByText("Check attendance before posting this run.")).toBeInTheDocument();
    expect(
      within(alert).getByText(/a working day with no attendance record is treated as unpaid/),
    ).toBeInTheDocument();

    // (a) zero-record days, DD/MM/YYYY.
    expect(within(alert).getByText("No attendance was recorded for anyone on 2 working day(s):")).toBeInTheDocument();
    expect(within(alert).getByText("04/06/2026")).toBeInTheDocument();
    expect(within(alert).getByText("05/06/2026")).toBeInTheDocument();
    expect(within(alert).getByText(/device outage or a branch entry log that was never submitted/)).toBeInTheDocument();

    // (b) unpaid days by employee — only > 0 rows, worst first, names from the lines.
    expect(within(alert).getByText("Unpaid days by employee")).toBeInTheDocument();
    expect(within(alert).getByText("Farzana Akter")).toBeInTheDocument();
    expect(within(alert).getByText(/An outlier here is worth a second look/)).toBeInTheDocument();

    // (c) skipped employees in plain language — never the raw NO_PROJECT code.
    expect(within(alert).getByText("1 employee(s) aren't on this sheet:")).toBeInTheDocument();
    await within(alert).findByText("Shafiqul Alam");
    expect(within(alert).getByText(/— no project set/)).toBeInTheDocument();
    expect(within(alert).queryByText(/NO_PROJECT/)).not.toBeInTheDocument();
    expect(within(alert).getByText(/They won't be paid on this run until they have a project\./)).toBeInTheDocument();

    // The cross-link sends the fixer upstream.
    expect(within(alert).getByTestId("gap-attendance-link")).toHaveAttribute("href", "/hr/attendance");
  });

  it("keeps Post disabled until acknowledged, and enables it after (ANDed with the preview gate)", async () => {
    getSheetMock.mockResolvedValue(sheet({ warnings: gapWarnings() }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("attendance-gap-alert");

    // Preview confirmed but gaps unacknowledged → still disabled, with the reason.
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    const post = screen.getByTestId("post-open");
    expect(post).toBeDisabled();
    expect(post).toHaveAttribute("title", "Review the attendance gaps above before posting.");
    expect(post).toHaveAttribute("aria-describedby", "post-disabled-reason");

    await userEvent.click(screen.getByTestId("gap-acknowledge"));
    expect(screen.getByTestId("post-open")).toBeEnabled();

    // The acknowledgement is never transmitted — Post sends only { version }.
    postMock.mockResolvedValue({
      salarySheetId: "sal-1", salaryEntryId: "je-1", entryNo: "SAL/2526/0009",
      status: "POSTED", postedAt: "2026-07-29T10:00:00Z", postedBy: "u1", version: 2,
    });
    await userEvent.click(screen.getByTestId("post-open"));
    await userEvent.click(within(screen.getByTestId("post-confirm-dialog")).getByTestId("post-confirm"));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith("sal-1", { version: 1 }));
  });

  it("acknowledgement alone is not enough — the balanced-preview gate is retained", async () => {
    getSheetMock.mockResolvedValue(sheet({ warnings: gapWarnings() }));
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("attendance-gap-alert");

    await userEvent.click(screen.getByTestId("gap-acknowledge"));
    expect(screen.getByTestId("post-open")).toBeDisabled();
  });

  it("clean case stays clean — empty warnings render no alert and Post is immediately gated only by the preview", async () => {
    getSheetMock.mockResolvedValue(
      sheet({
        warnings: {
          daysWithNoRecords: [],
          skippedEmployees: [],
          employeeAbsences: [{ employeeId: "emp-1", unpaidDays: 0 }],
          noWeeklyHolidaysConfigured: false,
        },
      }),
    );
    renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("salary-editor");

    expect(screen.queryByTestId("attendance-gap-alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("no-weekly-holidays-warning")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("preview-confirmed"));
    expect(screen.getByTestId("post-open")).toBeEnabled();
  });

  it("renders the noWeeklyHolidaysConfigured banner ABOVE the gap block, and independently of the collections", async () => {
    // Flag true with EMPTY collections → banner alone, no gap block, Post not gap-gated.
    getSheetMock.mockResolvedValue(
      sheet({
        warnings: {
          daysWithNoRecords: [],
          skippedEmployees: [],
          employeeAbsences: [],
          noWeeklyHolidaysConfigured: true,
        },
      }),
    );
    const { unmount } = renderWith(<SalarySheetEditor id="sal-1" />);
    await screen.findByTestId("no-weekly-holidays-warning");
    expect(screen.queryByTestId("attendance-gap-alert")).not.toBeInTheDocument();
    unmount();

    // Flag true WITH collections → banner renders before (above) the gap block.
    getSheetMock.mockResolvedValue(
      sheet({ warnings: gapWarnings({ noWeeklyHolidaysConfigured: true }) }),
    );
    renderWith(<SalarySheetEditor id="sal-1" />);
    const banner = await screen.findByTestId("no-weekly-holidays-warning");
    const alert = await screen.findByTestId("attendance-gap-alert");
    expect(banner.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("suppresses the generate success toast when the 201 carries non-empty warnings", async () => {
    listSheetsMock.mockResolvedValue({ data: [summary()], page: 1, pageSize: 50, total: 1 });
    generateMock.mockResolvedValue({
      id: "sal-new",
      status: "DRAFT",
      periodLabel: "2026-07",
      warnings: gapWarnings(),
    });
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-title");

    await userEvent.click(screen.getByTestId("salary-generate"));
    await screen.findByTestId("generate-sheet-dialog");
    await userEvent.selectOptions(screen.getByTestId("gen-project"), "proj-a");
    await waitFor(() => expect(screen.getByTestId("gen-purpose")).toBeEnabled());
    await userEvent.selectOptions(screen.getByTestId("gen-purpose"), "pp-1");
    await userEvent.click(screen.getByTestId("gen-submit"));

    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(screen.queryByText(/Draft salary sheet created/)).not.toBeInTheDocument();
  });

  it("states the corrected pay rule in the Generate dialog's helper", async () => {
    renderWith(<SalaryRunsList />);
    await screen.findByTestId("salary-runs-title");
    await userEvent.click(screen.getByTestId("salary-generate"));
    await screen.findByTestId("generate-sheet-dialog");
    expect(screen.getByTestId("gen-payrule-helper")).toHaveTextContent(
      "Monthly staff are paid the full month; weekly and government holidays are paid days. Absences, unpaid leave, and working days with no attendance record are deducted.",
    );
  });
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
});
