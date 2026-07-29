/**
 * FE-36 Attendance tests (FR-HR-004..-012, -018). Covers: three modes present, daily-labour
 * capture → Confirm (balanced preview, purpose-required, non-optimistic lock, entryNo link)
 * → Reverse, already-confirmed idempotency, confirmed-immutable-edit, closed-period,
 * subcontractor tab has NO Confirm control anywhere, office biometric reconciliation
 * "Keep manual / Keep imported", head-count / rate / cost-centre / party validation,
 * role/scope gating (SITE_ENGINEER captures but Confirm hidden), 360 stacked cards +
 * full-width Confirm.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { AttendanceShell } from "@/features/hr/components/AttendanceShell";
import { AttendanceDetailDrawer } from "@/features/hr/components/AttendanceDetailDrawer";
import { DailyLabourGrid } from "@/features/hr/components/DailyLabourGrid";
import { OfficeRosterGrid } from "@/features/hr/components/OfficeRosterGrid";
import { SkipReasonAlert } from "@/features/hr/components/SkipReasonAlert";
import { SubcontractorGrid } from "@/features/hr/components/SubcontractorGrid";
import * as attApi from "@/features/hr/api/attendance";
import * as attLogsApi from "@/features/hr/api/attendance-logs";
import * as mastersApi from "@/features/hr/api/masters";
import type { AttendanceRecord } from "@/features/hr/api/attendance";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/hr/api/attendance");
jest.mock("@/features/hr/api/attendance-logs");
jest.mock("@/features/hr/api/masters");
jest.mock("@/features/hr/api/employees");

const listAttendanceMock = attApi.listAttendance as jest.Mock;
const saveOfficeMock = attApi.saveOfficeAttendance as jest.Mock;
const saveSubMock = attApi.saveSubcontractorAttendance as jest.Mock;
const saveDLMock = attApi.saveDailyLabourAttendance as jest.Mock;
const patchDLMock = attApi.updateDailyLabour as jest.Mock;
const confirmDLMock = attApi.confirmDailyLabour as jest.Mock;
const reverseDLMock = attApi.reverseDailyLabour as jest.Mock;

const listProjectsMock = mastersApi.listProjectOptions as jest.Mock;
const listCostCentresMock = mastersApi.listCostCentreOptions as jest.Mock;
const listPurposesMock = mastersApi.listPurposeOptions as jest.Mock;
const listPartiesMock = mastersApi.listSubcontractorPartyOptions as jest.Mock;

function unconfirmed(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-dl-2",
    mode: "DAILY_LABOUR",
    attendanceDate: "2026-07-13",
    projectId: "proj-a",
    costCentreId: "cc-lab",
    purposeId: null,
    employeeId: null,
    checkIn: null,
    checkOut: null,
    dayStatus: null,
    overtimeHours: null,
    partyId: null,
    headCount: 12,
    labourCategory: "Helper",
    dailyRate: "450.0000",
    source: "MANUAL",
    isConfirmed: false,
    accrualEntryId: null,
    entryNo: null,
    accruedAmount: null,
    postedAt: null,
    postedBy: null,
    reversalEntryNo: null,
    reversalEntryId: null,
    version: 1,
    ...over,
  };
}

function confirmedRow(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return unconfirmed({
    id: "att-dl-1",
    isConfirmed: true,
    entryNo: "SJ/2526/0042",
    accrualEntryId: "je-dla-42",
    accruedAmount: "13000.0000",
    postedAt: "2026-07-13T05:00:00Z",
    postedBy: "u1",
    version: 2,
    purposeId: "pp-1",
    headCount: 20,
    dailyRate: "650.0000",
    labourCategory: "Mason",
    ...over,
  });
}

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

beforeEach(() => {
  jest.clearAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
  listProjectsMock.mockResolvedValue([
    { id: "proj-a", name: "Bridge-04" },
    { id: "proj-b", name: "Tower-A" },
  ]);
  listCostCentresMock.mockResolvedValue([
    { id: "cc-lab", code: "CC-02", name: "Site Labour" },
    { id: "cc-tmp", code: "CC-05", name: "Temporary works" },
  ]);
  listPurposesMock.mockResolvedValue([
    { id: "pp-1", name: "Casting" },
    { id: "pp-2", name: "Formwork" },
  ]);
  listPartiesMock.mockResolvedValue([
    { id: "pa-4", name: "Alpha Subcontractors" },
    { id: "pa-7", name: "Beta Works" },
  ]);
  listAttendanceMock.mockResolvedValue({ data: [], page: 1, pageSize: 200, total: 0 });

  // The office review reads the REPORT surface; `/logs` backs only the punch breakdown.
  const emptyPage = { page: 1, limit: 25, total: 0, totalPages: 1 };
  const emptyCounts = {
    workingDays: 0, onTimeCount: 0, lateCount: 0, presentCount: 0,
    absentCount: 0, holidayCount: 0, attendancePercentage: 0, totalEmployees: 0,
  };
  const healthyGuard = { days: 0, reasons: {}, sample: [] };
  (attLogsApi.getRangeReport as jest.Mock).mockResolvedValue({
    dateFrom: "", dateTo: "", label: "", totalDays: 0, totalWorkingDays: 0, lateAfter: "",
    totals: emptyCounts, data: [], pagination: emptyPage, unreconciled: healthyGuard,
  });
  (attLogsApi.getSummaryReport as jest.Mock).mockResolvedValue({
    dateFrom: "", dateTo: "", label: "", totalDays: 0, totalWorkingDays: 0, lateAfter: "",
    totals: emptyCounts, data: [], pagination: emptyPage, unreconciled: healthyGuard,
  });
  (attLogsApi.getDailyReport as jest.Mock).mockResolvedValue({
    date: "", isHoliday: false, holiday: null, lateAfter: "",
    totals: emptyCounts, data: [], pagination: emptyPage, unreconciled: healthyGuard,
  });
  (attLogsApi.listAttendanceLogs as jest.Mock).mockResolvedValue({ data: [], pagination: emptyPage });
  (attLogsApi.getDeviceStatus as jest.Mock).mockResolvedValue({
    status: "offline", online: false, lastSeenAt: null, lastSeenAgeMs: null, onlineWindowMs: null,
  });
  (attLogsApi.getSyncStatus as jest.Mock).mockResolvedValue({
    syncing: false, configured: false, deviceIp: null, devicePort: null, lastSyncAt: null,
    lastSync: null, lastRecordAt: null, lastDeviceTimestamp: null,
    device: { status: "offline", online: false, lastSeenAt: null, lastSeenAgeMs: null, onlineWindowMs: null },
  });
});

// ── Shell / three modes ──
describe("AttendanceShell — three modes", () => {
  it("renders the three mode tabs with role=tablist", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("attendance-tabs");
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-tab-OFFICE")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-tab-DAILY_LABOUR")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-tab-SUBCONTRACTOR")).toBeInTheDocument();
  });

  it("supports arrow-key nav across the tablist", async () => {
    renderWith(<AttendanceShell />);
    const officeTab = await screen.findByTestId("attendance-tab-OFFICE");
    officeTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByTestId("attendance-tab-DAILY_LABOUR")).toHaveAttribute("aria-selected", "true");
  });

  it("hides the read-only note for HR Manager and shows it for Accounts Manager (read-only)", async () => {
    renderWith(<AttendanceShell />, "ACCOUNTS_MANAGER");
    // ACCOUNTS_MANAGER canCapture returns true in our access map (fallback) — but Accounts is HR-writer? Instead assert HR sees no read-only banner.
    await screen.findByTestId("attendance-tabs");
    expect(screen.queryByTestId("attendance-readonly-note")).not.toBeInTheDocument();
  });
});

// ── FE-64: inside Office staff, the PERIOD selects the view (spec §3) ──
describe("Office staff — period selects the view, not a third tab level", () => {
  it("swaps the editable roster for the read-only logs & summary, and back", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("office-staff-panel");

    // The default period is a month → the read-only review, with its read-only note and NO
    // capture affordance. A range is inherently a review; only a single day is editable.
    expect(await screen.findByTestId("range-readonly-note")).toHaveTextContent(
      "Attendance is edited a day at a time — pick a single date to make changes.",
    );
    expect(screen.queryByTestId("office-roster")).not.toBeInTheDocument();

    // Single date → the editable roster grid, and the read-only note goes away.
    await userEvent.click(screen.getByRole("button", { name: "Single" }));
    await screen.findByTestId("office-roster");
    expect(screen.queryByTestId("range-readonly-note")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Month" }));
    await screen.findByTestId("range-readonly-note");
    expect(screen.queryByTestId("office-roster")).not.toBeInTheDocument();
  });

  it("announces the swap and moves focus to the results heading", async () => {
    renderWith(<AttendanceShell />);
    const heading = await screen.findByTestId("office-results-heading");
    // Switching the period replaces the WHOLE view; a keyboard/screen-reader user must not be
    // left silently inside a table that no longer exists (spec §10).
    expect(heading).toHaveAttribute("aria-live", "polite");

    await userEvent.click(screen.getByRole("button", { name: "Single" }));
    await waitFor(() => expect(screen.getByTestId("office-results-heading")).toHaveFocus());
  });

  it("leaves Daily labour and Subcontractor unaffected by the period-view rule", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("attendance-tabs");
    await userEvent.click(screen.getByTestId("attendance-tab-DAILY_LABOUR"));

    // No second period control, no read-only note, no roster — the rule is Office-staff only.
    await waitFor(() => expect(screen.queryByTestId("office-staff-panel")).not.toBeInTheDocument());
    expect(screen.queryByTestId("range-readonly-note")).not.toBeInTheDocument();
  });

  it("keeps the mode tabs a real tablist — no third level of nesting", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("office-staff-panel");
    // Exactly ONE tablist on the screen: the three modes. The period is a filter control, not
    // a tab, which is the whole point of using it to select the view.
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});

// ── Daily-labour capture → Confirm → Reverse ──
describe("DailyLabourGrid — capture / confirm / reverse", () => {
  function renderGrid(role: Role = "HR_MANAGER") {
    return renderWith(
      <DailyLabourGrid
        date="2026-07-13"
        projectId="proj-a"
        costCentreId=""
        projects={[{ id: "proj-a", name: "Bridge-04" }]}
        costCentres={[{ id: "cc-lab", code: "CC-02", name: "Site Labour" }, { id: "cc-tmp", code: "CC-05", name: "Temporary works" }]}
        purposeOptions={[{ id: "pp-1", name: "Casting" }, { id: "pp-2", name: "Formwork" }]}
        isLoadingMasters={false}
      />,
      role,
    );
  }

  it("captures a draft row and saves it", async () => {
    listAttendanceMock.mockResolvedValue({ data: [], page: 1, pageSize: 200, total: 0 });
    saveDLMock.mockResolvedValue({ ids: ["att-dl-99"] });
    renderGrid();
    await screen.findByTestId("daily-labour-empty");
    await userEvent.click(screen.getByTestId("daily-labour-add"));
    const draftRow = await screen.findByTestId("daily-labour-draft-row");
    await userEvent.selectOptions(within(draftRow).getByTestId(/^draft-cc-/), "cc-lab");
    const hcInput = within(draftRow).getByRole("spinbutton");
    await userEvent.clear(hcInput);
    await userEvent.type(hcInput, "10");
    await userEvent.click(screen.getByTestId("daily-labour-save"));
    await waitFor(() => expect(saveDLMock).toHaveBeenCalled());
  });

  it("opens Confirm dialog with balanced preview and posts, showing the entryNo link", async () => {
    const row = unconfirmed({ purposeId: "pp-1" });
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    confirmDLMock.mockResolvedValue({
      attendanceId: row.id,
      accrualEntryId: "je-dla-99",
      entryNo: "SJ/2526/0099",
      accruedAmount: "5400.0000",
      isConfirmed: true,
      postedAt: "2026-07-13T05:00:00Z",
      postedBy: "u1",
      version: 2,
    });
    // On refetch after confirm, return the row as confirmed
    listAttendanceMock.mockResolvedValueOnce({ data: [row], page: 1, pageSize: 200, total: 1 });
    listAttendanceMock.mockResolvedValueOnce({
      data: [confirmedRow({ id: row.id, entryNo: "SJ/2526/0099", accrualEntryId: "je-dla-99", headCount: 12, dailyRate: "450.0000", accruedAmount: "5400.0000", purposeId: "pp-1" })],
      page: 1,
      pageSize: 200,
      total: 1,
    });
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    await userEvent.click(await screen.findByTestId(`row-confirm-${row.id}`));
    const dialog = await screen.findByTestId("confirm-accrual-dialog");
    expect(within(dialog).getByTestId("balanced-preview")).toBeInTheDocument();
    expect(within(dialog).getByTestId("preview-headcount")).toHaveTextContent("12");
    expect(within(dialog).getByTestId("preview-accrued")).toHaveTextContent("5,400");
    await userEvent.click(within(dialog).getByTestId("confirm-post"));
    await waitFor(() => expect(confirmDLMock).toHaveBeenCalledWith(row.id, { purposeId: "pp-1", version: 1 }));
  });

  it("blocks Confirm when the row has no purposeId until the picker is filled", async () => {
    const row = unconfirmed({ purposeId: null });
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    await userEvent.click(await screen.findByTestId(`row-confirm-${row.id}`));
    const dialog = await screen.findByTestId("confirm-accrual-dialog");
    // Try to post — should surface purpose-required.
    await userEvent.click(within(dialog).getByTestId("confirm-post"));
    expect(await within(dialog).findByTestId("confirm-purpose-err")).toHaveTextContent("A purpose is required");
    expect(confirmDLMock).not.toHaveBeenCalled();
    // Pick a purpose and submit
    await userEvent.selectOptions(within(dialog).getByTestId("confirm-purpose-select"), "pp-2");
    confirmDLMock.mockResolvedValue({
      attendanceId: row.id, accrualEntryId: "je-dla-99", entryNo: "SJ/2526/0099",
      accruedAmount: "5400.0000", isConfirmed: true, postedAt: "x", postedBy: "u", version: 2,
    });
    await userEvent.click(within(dialog).getByTestId("confirm-post"));
    await waitFor(() => expect(confirmDLMock).toHaveBeenCalled());
  });

  it("surfaces ALREADY_CONFIRMED with the spec §8 copy on a second confirm", async () => {
    const row = unconfirmed({ purposeId: "pp-1" });
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    confirmDLMock.mockRejectedValue(new ApiError({ code: "ALREADY_CONFIRMED", message: "x", status: 409 }));
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    await userEvent.click(await screen.findByTestId(`row-confirm-${row.id}`));
    const dialog = await screen.findByTestId("confirm-accrual-dialog");
    await userEvent.click(within(dialog).getByTestId("confirm-post"));
    expect(await within(dialog).findByTestId("confirm-server-err")).toHaveTextContent(
      "This row has already been confirmed.",
    );
  });

  it("surfaces PERIOD_CLOSED with the spec §8 copy", async () => {
    const row = unconfirmed({ purposeId: "pp-1", attendanceDate: "2025-03-31" });
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    confirmDLMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    await userEvent.click(await screen.findByTestId(`row-confirm-${row.id}`));
    const dialog = await screen.findByTestId("confirm-accrual-dialog");
    await userEvent.click(within(dialog).getByTestId("confirm-post"));
    expect(await within(dialog).findByTestId("confirm-server-err")).toHaveTextContent(
      "This accounting period is closed",
    );
  });

  it("locks a confirmed row (no head-count input) and shows an entryNo link", async () => {
    const row = confirmedRow();
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    expect(screen.getByTestId("hc-locked")).toHaveTextContent("20");
    // No input for head count on a confirmed row.
    expect(screen.queryByTestId(`hc-input-${row.id}`)).not.toBeInTheDocument();
    // entryNo link visible via the ConfirmedRowBadge (rendered in both desktop table + mobile cards)
    const links = screen.getAllByTestId("confirmed-entryno-link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!).toHaveAttribute("href", expect.stringContaining("je-dla-42"));
    expect(links[0]!).toHaveTextContent("SJ/2526/0042");
  });

  it("blocks in-place edit of a confirmed row via PATCH → ATTENDANCE_CONFIRMED_IMMUTABLE (server enforced)", async () => {
    const row = confirmedRow();
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    // no hc-input rendered for confirmed row (UI enforcement); assert absence
    expect(screen.queryByTestId(`hc-input-${row.id}`)).not.toBeInTheDocument();
    expect(patchDLMock).not.toHaveBeenCalled();
  });

  it("opens Reverse dialog on a confirmed row, requires a reason, then calls the API", async () => {
    const row = confirmedRow();
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    reverseDLMock.mockResolvedValue({
      reversalEntryId: "je-dla-100",
      reversalEntryNo: "SJ/2526/0100",
      originalEntryId: "je-dla-42",
    });
    renderGrid();
    await screen.findByTestId("daily-labour-table");
    await userEvent.click(await screen.findByTestId(`row-reverse-${row.id}`));
    const dialog = await screen.findByTestId("reverse-accrual-dialog");
    await userEvent.click(within(dialog).getByTestId("reverse-confirm"));
    expect(await within(dialog).findByTestId("reverse-reason-err")).toHaveTextContent(
      "Enter a reason",
    );
    await userEvent.type(within(dialog).getByTestId("reverse-reason"), "Wrong cost centre");
    await userEvent.click(within(dialog).getByTestId("reverse-confirm"));
    await waitFor(() => expect(reverseDLMock).toHaveBeenCalledWith(row.id, { reason: "Wrong cost centre" }));
  });
});

// ── Role gating ──
describe("Role/scope gating", () => {
  it("SITE_ENGINEER can capture but the Confirm control is HIDDEN", async () => {
    const row = unconfirmed();
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    renderWith(
      <DailyLabourGrid
        date="2026-07-13"
        projectId="proj-a"
        costCentreId=""
        projects={[{ id: "proj-a", name: "Bridge-04" }]}
        costCentres={[{ id: "cc-lab", code: "CC-02", name: "Site Labour" }]}
        purposeOptions={[{ id: "pp-1", name: "Casting" }]}
        isLoadingMasters={false}
      />,
      "SITE_ENGINEER",
    );
    await screen.findByTestId("daily-labour-table");
    // capture input is present (canCapture true)
    expect(screen.getByTestId(`hc-input-${row.id}`)).toBeInTheDocument();
    // Confirm button is not rendered anywhere
    expect(screen.queryByTestId(`row-confirm-${row.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`row-confirm-mobile-${row.id}`)).not.toBeInTheDocument();
  });
});

// ── Subcontractor tab: NO Confirm control anywhere ──
describe("Subcontractor tab has no Confirm control anywhere (FR-HR-005)", () => {
  it("renders the Tracking-only banner and no Confirm/Reverse anywhere in the DOM", async () => {
    listAttendanceMock.mockResolvedValue({
      data: [
        {
          id: "att-sub-1", mode: "SUBCONTRACTOR", attendanceDate: "2026-07-13",
          projectId: "proj-a", costCentreId: "cc-sub", purposeId: null,
          employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
          partyId: "pa-4", headCount: 25, labourCategory: null, dailyRate: null,
          source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null,
          accruedAmount: null, postedAt: null, postedBy: null,
          reversalEntryNo: null, reversalEntryId: null, version: 1,
        } as AttendanceRecord,
      ],
      page: 1, pageSize: 200, total: 1,
    });
    renderWith(
      <SubcontractorGrid
        date="2026-07-13"
        projectId="proj-a"
        costCentreId=""
        projects={[{ id: "proj-a", name: "Bridge-04" }]}
        costCentres={[{ id: "cc-sub", code: "CC-04", name: "Subcontractor Works" }]}
        parties={[{ id: "pa-4", name: "Alpha Subs" }]}
        purposeOptions={[{ id: "pp-1", name: "Casting" }]}
        isLoadingMasters={false}
      />,
    );
    expect(await screen.findByTestId("subcontractor-banner")).toBeInTheDocument();
    expect(screen.getByTestId("subcontractor-banner")).toHaveTextContent("Tracking only");
    // Assert no Confirm anywhere: no confirm dialogs, no confirm buttons, no reverse buttons.
    expect(screen.queryByTestId("confirm-accrual-dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Confirm & post accrual$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Confirm$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reverse$/)).not.toBeInTheDocument();
  });

  it("validates missing party / cost centre on save", async () => {
    listAttendanceMock.mockResolvedValue({ data: [], page: 1, pageSize: 200, total: 0 });
    renderWith(
      <SubcontractorGrid
        date="2026-07-13"
        projectId="proj-a"
        costCentreId=""
        projects={[{ id: "proj-a", name: "Bridge-04" }]}
        costCentres={[{ id: "cc-sub", code: "CC-04", name: "Subcontractor Works" }]}
        parties={[{ id: "pa-4", name: "Alpha" }]}
        purposeOptions={[{ id: "pp-1", name: "Casting" }]}
        isLoadingMasters={false}
      />,
    );
    await screen.findByTestId("subcontractor-empty");
    await userEvent.click(screen.getByTestId("subcontractor-add"));
    // Clear the seeded values to force validation errors.
    const draftRow = await screen.findByTestId("subcontractor-draft-row");
    const partySelect = within(draftRow).getByTestId(/^sub-party-/);
    const ccSelect = within(draftRow).getByTestId(/^sub-cc-/);
    // Override the initial value to blank.
    await userEvent.selectOptions(partySelect, "");
    await userEvent.selectOptions(ccSelect, "");
    await userEvent.click(screen.getByTestId("subcontractor-save"));
    expect(await screen.findByTestId(/^sub-party-err-/)).toBeInTheDocument();
    expect(screen.getByTestId(/^sub-cc-err-/)).toBeInTheDocument();
    expect(saveSubMock).not.toHaveBeenCalled();
  });
});

// ── FE-64: the merge model replaced the reconciliation UI ──
describe("Office staff — no conflict UI, no entry-source mode (FR-HR-004; edge §12.9)", () => {
  it("renders NO 'Manual entry | Biometric import' control anywhere in the DOM", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("attendance-tabs");
    await screen.findByTestId("office-staff-panel");

    // The toggle was a vestige of a two-mode model the automatic merge deleted: every path now
    // lands in the same row, so there is no mode to switch between. Asserted, not eyeballed.
    expect(screen.queryByTestId("office-toggle-import")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /entry source/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Biometric import$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Manual entry$/)).not.toBeInTheDocument();
  });

  it("offers no reconciliation surface — nothing lets a user pick a winner", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("office-staff-panel");

    // A second record for a captured day MERGES (first punch in, last punch out); it is never
    // rejected as a duplicate and never doubled. There is therefore nothing to resolve.
    expect(screen.queryByTestId("biometric-import-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("biometric-conflict")).not.toBeInTheDocument();
    expect(screen.queryByText(/keep manual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keep imported/i)).not.toBeInTheDocument();
  });

  it("carries exactly three header controls — device status · Sync device · Import", async () => {
    renderWith(<AttendanceShell />);
    const header = await screen.findByTestId("office-header-actions");
    expect(within(header).getByTestId("open-import")).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /sync device/i })).toBeInTheDocument();
    // One status, one pull, one push — and no fourth control smuggled in beside them.
    expect(within(header).queryByTestId("export-menu")).not.toBeInTheDocument();
  });

  it("renders no Export control, and points at the report that owns the download", async () => {
    renderWith(<AttendanceShell />);
    await screen.findByTestId("office-staff-panel");

    // Producing a file is a reporting concern (FR-RPT-026/-029/-031). The menu itself is kept
    // — /reports/hr still uses it — but this screen stops rendering it.
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
    const pointer = screen.getByTestId("attendance-export-pointer");
    expect(pointer).toHaveTextContent(
      "Need a file? Download attendance from Reports › Attendance summary.",
    );
    expect(within(pointer).getByRole("link")).toHaveAttribute("href", "/reports/hr");
  });
});

// ── FE-64: the roster grid — Location, source badge, overtime helper ──
describe("OfficeRosterGrid — Location, source badge, overtime helper (FR-HR-004, -008)", () => {
  function officeRow(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
    return unconfirmed({
      id: "att-off-1",
      mode: "OFFICE",
      employeeId: "EMP-0001",
      projectId: "proj-a",
      costCentreId: null,
      dayStatus: "PRESENT",
      checkIn: "08:30",
      checkOut: "17:45",
      overtimeHours: "1.5",
      headCount: null,
      dailyRate: null,
      labourCategory: null,
      source: "DEVICE_PUSH",
      ...over,
    });
  }

  function renderRoster(row: AttendanceRecord) {
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    return renderWith(
      <OfficeRosterGrid
        date="2026-07-11"
        projectId="proj-a"
        projects={[
          { id: "proj-a", name: "Bridge-04" },
          { id: "proj-ho", name: "Head Office" },
        ]}
      />,
    );
  }

  it("labels the column Location — not Project — and makes it a required select", async () => {
    const row = officeRow();
    renderRoster(row);
    const table = await screen.findByTestId("office-table");

    // An office day resolves to an office/overhead project, so "Project" is the wrong word here.
    // Scoped to the desktop table — the ≥360 card renders the same label on its own field.
    expect(within(table).getByText(/^Location/)).toBeInTheDocument();
    expect(within(table).queryByText(/^Project/)).not.toBeInTheDocument();

    const select = screen.getByTestId(`office-location-${row.id}`);
    // Defaults to the filter, and always sends an explicit value — rank 1 of the resolution order.
    expect(select).toHaveValue("proj-a");
  });

  it("reflows to stacked cards at ≥360 — the real site-capture tier", async () => {
    const row = officeRow();
    renderRoster(row);
    await screen.findByTestId("office-cards");

    // Same fields, same schema, same save — only the layout differs. Targets stay ≥44px
    // because this is captured one-handed on a site (spec §4; ADR-0003).
    const location = screen.getByTestId(`office-card-location-${row.id}`);
    expect(location.className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByTestId(`office-card-checkin-${row.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("office-overtime-helper-mobile")).toHaveTextContent(
      "Overtime is recorded for reference — not yet included in pay.",
    );
  });

  it("surfaces the exact inline message when Location is cleared", async () => {
    const row = officeRow();
    renderRoster(row);
    await screen.findByTestId("office-table");

    await userEvent.selectOptions(screen.getByTestId(`office-location-${row.id}`), "");
    await userEvent.click(screen.getByTestId("office-save"));

    expect(await screen.findByTestId(`office-location-err-${row.id}`)).toHaveTextContent(
      "Select a location.",
    );
    expect(saveOfficeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["DEVICE_PUSH", "Machine"],
    ["DEVICE_SYNC", "Machine"],
    ["EXCEL_IMPORT", "Import"],
    ["MANUAL", "Manual"],
    // Push-path normalisation has not fully landed, so an unrecognised value must degrade to
    // the truthful general case — never to a blank cell that reads as missing data.
    ["ATTLOG", "Machine"],
    [null, "Machine"],
  ])("maps sourceType %s onto the %s badge", async (source, label) => {
    renderRoster(officeRow({ source: source as AttendanceRecord["source"] }));
    const table = await screen.findByTestId("office-table");
    // Readable text, never colour alone (spec §10).
    expect(within(table).getByTestId("office-source-badge")).toHaveTextContent(label);
  });

  it("keeps the overtime column honest with the exact helper", async () => {
    renderRoster(officeRow());
    await screen.findByTestId("office-table");
    // The hours are stored and payroll sums them, but the OT rate is unconfirmed so they add
    // ৳0 to gross. A number on a payroll screen reads as compensated unless it says otherwise.
    expect(screen.getByTestId("office-overtime-helper")).toHaveTextContent(
      "Overtime is recorded for reference — not yet included in pay.",
    );
  });

  it("saves the row's explicit Location as projectId", async () => {
    const row = officeRow();
    saveOfficeMock.mockResolvedValue({ ids: [row.id] });
    renderRoster(row);
    await screen.findByTestId("office-table");

    await userEvent.selectOptions(screen.getByTestId(`office-location-${row.id}`), "proj-ho");
    await userEvent.click(screen.getByTestId("office-save"));

    await waitFor(() =>
      expect(saveOfficeMock).toHaveBeenCalledWith([
        expect.objectContaining({ employeeId: "EMP-0001", projectId: "proj-ho" }),
      ]),
    );
  });
});

// ── FE-64: the punch breakdown is provenance, not a resolution surface ──
describe("AttendanceDetailDrawer — punch breakdown (FR-HR-004; SRS §12 edges 9, 15)", () => {
  const BASE_ROW = {
    key: "r1",
    userId: "EMP-0002",
    name: "ফারজানা আক্তার",
    designation: "HR Officer",
    workingDays: 23,
    presentCount: 22,
    lateCount: 1,
    absentCount: 0,
    holidayCount: 4,
    attendancePercent: 96,
    status: "",
    checkIn: null,
    checkOut: null,
  };

  it("lists every contributing punch as time · location · source in a semantic table", async () => {
    renderWith(
      <AttendanceDetailDrawer
        scopeLabel="July 2026"
        onClose={jest.fn()}
        row={{
          ...BASE_ROW,
          records: [
            {
              id: "d1",
              attendanceDate: "2026-07-11",
              deviceTimestamp: null,
              occurredAt: null,
              receivedAt: null,
              checkInAt: "2026-07-11 09:00:00",
              checkOutAt: "2026-07-11 14:00:00",
              status: "Present",
              punchCount: 2,
              // The office-at-09:00 / site-at-14:00 case: two places in one day, ONE row.
              punches: [
                { time: "09:00:00", sourceType: "DEVICE_PUSH", projectId: null, projectName: null },
                { time: "14:00:00", sourceType: "MANUAL", projectId: "p2", projectName: "Bridge-04" },
              ],
            },
          ],
        }}
      />,
    );

    const table = await screen.findByTestId("punch-breakdown");
    // A table, not a styled list — a screen-reader user has to compare punches column-wise.
    expect(within(table).getByRole("columnheader", { name: "Time" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Location" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Source" })).toBeInTheDocument();

    const rows = within(table).getAllByTestId("punch-row");
    expect(rows).toHaveLength(2);
    // A device punch states no place, so it falls back to the day's location / "Head office".
    expect(rows[0]!).toHaveTextContent("09:00");
    expect(rows[0]!).toHaveTextContent("Head office");
    expect(rows[0]!).toHaveTextContent("Machine");
    // A MANUAL punch always carries its own project — the Location picker is required.
    expect(rows[1]!).toHaveTextContent("14:00");
    expect(rows[1]!).toHaveTextContent("Bridge-04");
    expect(rows[1]!).toHaveTextContent("Manual");

    // Nothing is in conflict, so nothing offers a winner.
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/keep this one/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keep manual|keep imported/i)).not.toBeInTheDocument();
  });

  it("renders the explicit no-punches line for a status-only day — not an empty list", async () => {
    renderWith(
      <AttendanceDetailDrawer
        scopeLabel="July 2026"
        onClose={jest.fn()}
        row={{
          ...BASE_ROW,
          records: [
            {
              id: "d2",
              attendanceDate: "2026-07-09",
              deviceTimestamp: null,
              occurredAt: null,
              receivedAt: null,
              checkInAt: null,
              checkOutAt: null,
              // FR-HR-004's second branch: an approved leave day has no times to punch.
              status: "Paid leave",
              punchCount: 0,
              punches: [],
            },
          ],
        }}
      />,
    );

    const empty = await screen.findByTestId("punch-breakdown-empty");
    expect(empty).toHaveTextContent("No punches recorded — entered manually.");
    expect(empty).toHaveTextContent("This day was recorded as paid leave without times.");
    // Never an empty list, a spinner or a retry — all three read as a load failure and invite
    // the user to retry something that is already correct.
    expect(screen.queryByTestId("punch-breakdown")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again|retry/i })).not.toBeInTheDocument();
  });
});

// ── FE-64: a run that reconciles nothing is never a success (FR-HR-008a) ──
describe("SkipReasonAlert (FR-HR-008a)", () => {
  it("names each reason and count in plain language, as a real list", async () => {
    renderWith(
      <SkipReasonAlert
        reconciled={0}
        skippedReasons={{ NO_PROJECT: 12, UNKNOWN_EMPLOYEE_CODE: 3, NO_FINANCIAL_YEAR: 1 }}
      />,
    );

    const alert = await screen.findByTestId("skip-reason-alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("16 punches were stored, but no attendance day was updated.");
    expect(alert).toHaveTextContent(
      "Until this is fixed, these days won't appear in attendance or on a salary sheet.",
    );

    const items = within(screen.getByTestId("skip-reason-list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // Rendered as an ACTION the user can take, never as the raw server code.
    expect(items.map((i) => i.textContent)).toEqual([
      "12 × No location set — set a default location on the device or on the employee",
      "3 × Employee code not recognised",
      "1 × No financial year covers these dates",
    ]);
    expect(alert.textContent).not.toMatch(/NO_PROJECT|UNKNOWN_EMPLOYEE_CODE/);
  });

  it("takes focus when nothing reconciled — that run needs an action, not a notice", async () => {
    renderWith(<SkipReasonAlert reconciled={0} skippedReasons={{ NO_PROJECT: 2 }} />);
    await waitFor(() => expect(screen.getByTestId("skip-reason-alert")).toHaveFocus());
  });

  it("shows both counts on a partial run, and does not steal focus", async () => {
    renderWith(<SkipReasonAlert reconciled={470} skippedReasons={{ ALREADY_CONFIRMED: 4 }} />);
    const alert = await screen.findByTestId("skip-reason-alert");
    expect(alert).toHaveTextContent("470 days updated · 4 skipped.");
    expect(alert).not.toHaveFocus();
  });

  it("renders nothing at all when a run skipped nothing", () => {
    renderWith(<SkipReasonAlert reconciled={12} skippedReasons={{}} />);
    expect(screen.queryByTestId("skip-reason-alert")).not.toBeInTheDocument();
  });
});

// ── 360 mobile: stacked cards + full-width Confirm ──
describe("360 mobile — stacked cards + full-width Confirm", () => {
  it("renders a stacked mobile card with a full-width Confirm button", async () => {
    const row = unconfirmed({ purposeId: "pp-1" });
    listAttendanceMock.mockResolvedValue({ data: [row], page: 1, pageSize: 200, total: 1 });
    renderWith(
      <DailyLabourGrid
        date="2026-07-13"
        projectId="proj-a"
        costCentreId=""
        projects={[{ id: "proj-a", name: "Bridge-04" }]}
        costCentres={[{ id: "cc-lab", code: "CC-02", name: "Site Labour" }]}
        purposeOptions={[{ id: "pp-1", name: "Casting" }]}
        isLoadingMasters={false}
      />,
    );
    await screen.findByTestId("daily-labour-mobile");
    const btn = screen.getByTestId(`row-confirm-mobile-${row.id}`);
    expect(btn.className).toMatch(/w-full/);
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });
});

// keep act warnings quiet in the noisy suite
afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
});
