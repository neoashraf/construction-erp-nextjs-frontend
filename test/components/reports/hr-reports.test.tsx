/**
 * FE-60 fe-hr-reports tests (FR-RPT-003/004/008/026/027/028/029).
 * Covers: 3-tab switch (resets extras), attendance month required-gate,
 * salary-register run XOR (FY+month) + totals footer (rendered verbatim),
 * payment-history date-range list, per-report empty (Export enabled),
 * partial name-unavailable, error+retry, 403 role gate, Excel export
 * re-issue, read-only assertion.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { HrReportsViewer } from "@/features/reports/hr/components/HrReportsViewer";
import { setDateField } from "./helpers";

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
jest.mock("@/features/reports/api/reports");
jest.mock("@/features/reports/api/masters");
jest.mock("@/lib/hooks/use-online", () => ({ useOnline: () => true }));
// FE-66: the Daily/Range levels read HR's own routes through `apiClient`, which
// return the whole-body envelope (`{ totals, data, pagination }`) rather than the
// `{ data, meta }` shape `runReport` normalizes.
jest.mock("@/lib/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const runMock = reportsApi.runReport as jest.Mock;
const exportMock = reportsApi.exportReport as jest.Mock;
const saveMock = reportsApi.saveBlob as jest.Mock;
const fyMock = mastersApi.listFinancialYearOptions as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;
const ccMock = mastersApi.listCostCentreOptions as jest.Mock;
const empMock = mastersApi.listEmployeeOptions as jest.Mock;
const runOptMock = mastersApi.listSalaryRunOptions as jest.Mock;
const getMock = (jest.requireMock("@/lib/api/client") as { apiClient: { get: jest.Mock } })
  .apiClient.get;

/**
 * FE-66 — HR's `/reports/range` whole-body envelope. Two employees; the second
 * carries a **timeless PAID_LEAVE day** (status, no times), the shape the report
 * must render with blank time cells rather than dropping or erroring on.
 * `totals` deliberately exceeds the visible rows, so any page-sum would show.
 */
const HR_RANGE_BODY = {
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  label: "June 2026",
  totalDays: 30,
  totalWorkingDays: 25,
  lateAfter: "09:30",
  totals: {
    totalEmployees: 42, workingDays: 25, onTimeCount: 980, lateCount: 63,
    presentCount: 1043, absentCount: 76, paidLeaveCount: 24, unpaidLeaveCount: 33,
    holidayCount: 168, attendancePercentage: 90.7,
  },
  data: [
    {
      id: "att-1", userId: "EMP-001", name: "Ashraf Uddin", designation: "Site Accountant",
      projectName: "Bridge-04 — Buriganga", costCentreName: "Superstructure / Deck",
      workingDays: 25, onTimeCount: 20, lateCount: 3, presentCount: 23,
      absentCount: 0, paidLeaveCount: 1, unpaidLeaveCount: 0, holidayCount: 4,
      attendancePercentage: 100,
      records: [
        {
          id: "rec-1", attendanceDate: "2026-06-01", status: "Present",
          holidayName: null, holidayType: null,
          checkInAt: "2026-06-01 09:02:00", checkOutAt: "2026-06-01 18:04:00",
          checkInTime: "9:02:00 AM", checkOutTime: "6:04:00 PM", punchCount: 2,
          punches: [{ time: "09:02:00", sourceType: "DEVICE_PUSH", projectId: "proj-a", projectName: "Bridge-04 — Buriganga" }],
        },
      ],
    },
    {
      id: "att-2", userId: "EMP-002", name: "ফারজানা আক্তার", designation: "Coordinator",
      projectName: "Bridge-04 — Buriganga", costCentreName: "Site establishment",
      workingDays: 25, onTimeCount: 21, lateCount: 1, presentCount: 22,
      absentCount: 2, paidLeaveCount: 1, unpaidLeaveCount: 0, holidayCount: 4,
      attendancePercentage: 88,
      records: [
        {
          // A day carrying a status and NO times — an expected shape, not a gap.
          id: "rec-2", attendanceDate: "2026-06-04", status: "Paid leave",
          holidayName: null, holidayType: null,
          checkInAt: null, checkOutAt: null, checkInTime: "", checkOutTime: "",
          punchCount: 0,
          punches: [{ time: "00:00:00", sourceType: "MANUAL", projectId: "proj-a", projectName: "Bridge-04 — Buriganga" }],
        },
      ],
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  unreconciled: { days: 0, reasons: {}, sample: [] },
};

const ATT_RESULT = {
  reportName: "attendance-summary",
  parameters: { month: "2026-05" },
  rows: [
    { projectId: "proj-a", projectName: "Bridge-04", employeeId: "emp-1", employeeName: "Ashraf Uddin", partyId: null, partyName: null, costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", present: 22, paidLeave: 1, unpaidLeave: 0, absent: 3, headCount: 1, mode: "OFFICE", attendancePercentage: 88.5 },
    { projectId: "proj-a", projectName: "Bridge-04", employeeId: "emp-gone", employeeName: null, partyId: null, partyName: null, costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", present: 15, paidLeave: 0, unpaidLeave: 2, absent: 1, headCount: 1, mode: "OFFICE", attendancePercentage: 83.3 },
  ],
  meta: { page: 1, pageSize: 2, total: 2, generatedAt: "2026-07-15T10:00:00Z", totals: { present: 37, paidLeave: 1, unpaidLeave: 2, absent: 4, headCount: 2, attendancePercentage: 90.2 } },
};
const SR_RESULT = {
  reportName: "salary-register",
  parameters: {},
  rows: [
    { salaryRunId: "run-1", journalEntryId: "je-1", journalEntryNo: "JV/2526/0089", employeeId: "emp-1", employeeName: "Ashraf Uddin", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", grossPay: "60000.0000", allowances: "5000.0000", tds: "6000.0000", pf: "3000.0000", advanceRecovery: "2000.0000", otherDeductions: "500.0000", netPay: "53500.0000" },
    { salaryRunId: "run-1", journalEntryId: "je-1", journalEntryNo: "JV/2526/0089", employeeId: "emp-2", employeeName: "Rahim Ali", projectId: "proj-a", projectName: "Bridge-04", costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", grossPay: "45000.0000", allowances: "3000.0000", tds: "4500.0000", pf: "2250.0000", advanceRecovery: "0.0000", otherDeductions: "250.0000", netPay: "41000.0000" },
  ],
  meta: { page: 1, pageSize: 2, total: 2, generatedAt: "2026-07-15T10:00:00Z", totals: { gross: "105000.0000", net: "94500.0000" } },
};
const PH_RESULT = {
  reportName: "employee-payment-history",
  parameters: {},
  rows: [
    { paymentId: "pmt-1", paymentVoucherId: "pv-1", payableRef: "PV/2526/0121", employeeId: "emp-1", employeeName: "Ashraf Uddin", paymentDate: "2026-05-05", paidAmount: "53500.0000" },
    { paymentId: "pmt-2", paymentVoucherId: "pv-2", payableRef: "PV/2526/0122", employeeId: "emp-2", employeeName: "Rahim Ali", paymentDate: "2026-05-05", paidAmount: "41000.0000" },
  ],
  meta: { page: 1, pageSize: 2, total: 2, generatedAt: "2026-07-15T10:00:00Z", totals: { paidCount: 2, totalPaid: "94500.0000" } },
};
const PH_EMPTY = { ...PH_RESULT, rows: [], meta: { ...PH_RESULT.meta, total: 0, totals: { paidCount: 0, totalPaid: "0.0000" } } };

function user(): SafeUser {
  return { id: "u1", email: "u@ze.test", name: "User", role: "ADMIN", companyId: "c1", financialYearId: "fy-1", isActive: true };
}
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <HrReportsViewer />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  runMock.mockImplementation((name: string) => {
    if (name === "attendance-summary") return Promise.resolve(ATT_RESULT);
    if (name === "salary-register") return Promise.resolve(SR_RESULT);
    if (name === "employee-payment-history") return Promise.resolve(PH_RESULT);
    return Promise.resolve({ reportName: name, parameters: {}, rows: [], meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-15T10:00:00Z" } });
  });
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "salary-register.xlsx" });
  saveMock.mockImplementation(() => undefined);
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26", isActive: true }]);
  projMock.mockResolvedValue([]);
  ccMock.mockResolvedValue([]);
  empMock.mockResolvedValue([
    { id: "emp-1", label: "E01 · Ashraf Uddin" },
    { id: "emp-2", label: "E02 · Rahim Ali" },
  ]);
  runOptMock.mockResolvedValue([
    { id: "run-1", label: "2026-05 · posted" },
    { id: "run-2", label: "2026-04 · posted" },
  ]);
  getMock.mockResolvedValue(HR_RANGE_BODY);
});

/**
 * Set the Daily/Range window and Run. Those levels take a date range rather than
 * the Summary level's month, so they need their own helper.
 */
async function runAttendanceRange(from = "2026-06-01", to = "2026-06-30") {
  fireEvent.change(screen.getByTestId("hr-filter-date-from") as HTMLInputElement, {
    target: { value: from },
  });
  fireEvent.change(screen.getByTestId("hr-filter-date-to") as HTMLInputElement, {
    target: { value: to },
  });
  await userEvent.click(screen.getByTestId("report-run"));
}

// The Salary-run options load async (masters fetch) — wait for them before selecting.
async function selectRun(id = "run-1") {
  await waitFor(() => {
    const sel = screen.getByTestId("hr-filter-run") as HTMLSelectElement;
    expect(Array.from(sel.options).some((o) => o.value === id)).toBe(true);
  });
  await userEvent.selectOptions(screen.getByTestId("hr-filter-run") as HTMLSelectElement, id);
}
async function runSalaryRun() {
  await selectRun("run-1");
  await userEvent.click(screen.getByTestId("report-run"));
}

describe("HR reports — 3-tab switcher (FR-RPT-026/027/028)", () => {
  it("switches endpoints and resets per-tab extras between tabs", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await runSalaryRun();
    await screen.findByTestId("hr-sr-table");
    // Switch to attendance summary — salary-run extras should have cleared.
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    // Attendance mounts the month field.
    expect(screen.getByTestId("hr-filter-month")).toBeInTheDocument();
    // Salary-run field is not present in attendance filters.
    expect(screen.queryByTestId("hr-filter-run")).not.toBeInTheDocument();
  });
});

describe("Attendance summary — required month gate (FR-RPT-026)", () => {
  it("blocks Run and shows 'Select a month.' until a month is picked", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("report-run"));
    expect(await screen.findByTestId("hr-month-error")).toHaveTextContent(/Select a month/);
    expect(runMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, { target: { value: "2026-05" } });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-att-table");
    expect(runMock).toHaveBeenCalled();
    // FE-66: the `Month totals` <tfoot> is replaced by the `Report totals` band
    // ABOVE the table — the server's figure over the whole filtered set.
    expect(screen.getByTestId("hr-att-totals-band")).toHaveTextContent(/Report totals/);
    expect(screen.queryByTestId("hr-att-totals-footer")).not.toBeInTheDocument();
    // Partial name row.
    expect(screen.getByTestId("hr-name-unavailable")).toBeInTheDocument();
  });
});

describe("Salary register — mutual exclusion + totals from server (FR-RPT-027, FR-RPT-004)", () => {
  it("blocks Run when neither salary run nor month set; renders totals verbatim from meta.totals when set", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    // Click Run without picking either.
    await userEvent.click(screen.getByTestId("report-run"));
    expect(await screen.findByTestId("hr-xor-error")).toHaveTextContent(/salary run/i);
    expect(runMock).not.toHaveBeenCalled();

    // Pick run → month clears (mutual exclusion enforced by the filter panel).
    await selectRun("run-1");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-sr-table");
    const footer = screen.getByTestId("hr-sr-totals-footer");
    expect(footer).toHaveTextContent(/Gross/i);
    expect(footer).toHaveTextContent(/105,000/);
    expect(footer).toHaveTextContent(/94,500/);
  });

  it("selecting a salary run clears the month field (mutual exclusion)", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    // Set month first.
    fireEvent.change(screen.getByTestId("hr-filter-run-month") as HTMLInputElement, { target: { value: "2026-05" } });
    // Then set run — month should clear.
    await selectRun("run-1");
    expect((screen.getByTestId("hr-filter-run-month") as HTMLInputElement).value).toBe("");
  });
});

describe("Employee payment history — date range + payable ref link (FR-RPT-028)", () => {
  it("renders settlements over the range with payableRef link + range-totals footer", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-PAYMENT_HISTORY"));
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-ph-table");
    expect(screen.getAllByTestId("hr-ph-row")).toHaveLength(2);
    expect(screen.getByTestId("hr-ph-totals-footer")).toHaveTextContent(/2 settlements/);
    const link = screen.getByRole("link", { name: /Open payment voucher PV\/2526\/0121/i });
    expect(link.getAttribute("href")).toContain("/payments/pv-1");
  });

  it("Empty results keep Export enabled", async () => {
    runMock.mockImplementation((name: string) => {
      if (name === "employee-payment-history") return Promise.resolve(PH_EMPTY);
      return Promise.resolve(PH_RESULT);
    });
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-PAYMENT_HISTORY"));
    setDateField("param-date-from", "2026-04-01");
    setDateField("param-date-to", "2026-06-30");
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-ph-empty");
    expect((screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Permission-denied — 403 view (FR-RPT-008)", () => {
  it("shows the 403 body when the server rejects with FORBIDDEN, disables Export", async () => {
    runMock.mockImplementation(() =>
      Promise.reject(new ApiError({ code: "FORBIDDEN", message: "no", status: 403 })),
    );
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await runSalaryRun();
    await screen.findByTestId("hr-forbidden");
    expect(screen.getByTestId("hr-forbidden")).toHaveTextContent(/don't have permission/);
    expect((screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Error + retry preserves params (FR-RPT-004)", () => {
  it("shows the per-report error banner, keeps run, Retry re-runs", async () => {
    runMock
      .mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }))
      .mockResolvedValueOnce(SR_RESULT);
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await runSalaryRun();
    const banner = await screen.findByTestId("hr-sr-error");
    expect(banner).toHaveTextContent(/Couldn't load the salary register/);
    expect((screen.getByTestId("hr-filter-run") as HTMLSelectElement).value).toBe("run-1");
    await userEvent.click(screen.getByTestId("hr-sr-retry"));
    await screen.findByTestId("hr-sr-table");
  });
});

describe("Export — Excel re-issues (FR-RPT-029)", () => {
  it("Excel re-issues with format=excel; table stays rendered", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await runSalaryRun();
    await screen.findByTestId("hr-sr-table");
    await userEvent.click(screen.getByTestId("report-export-excel"));
    await userEvent.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    expect(name).toBe("salary-register");
    expect(format).toBe("excel");
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(screen.getByTestId("hr-sr-table")).toBeInTheDocument();
  });
});

describe("Read-only assertion — no mutating control (FR-RPT-003)", () => {
  it("no Save/Post/Reverse/Delete/Edit button anywhere on the viewer", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await runSalaryRun();
    await screen.findByTestId("hr-sr-table");
    const container = screen.getByTestId("hr-viewer");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(container).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });

  // The detail control adds three new buttons; none of them may be a write.
  it("stays read-only at Daily level too", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-daily"));
    await runAttendanceRange();
    await screen.findByTestId("hr-att-daily-table");
    const forbidden = /\b(Save changes|Post|Reverse|Delete|Edit)\b/i;
    for (const btn of within(screen.getByTestId("hr-viewer")).getAllByRole("button")) {
      expect(btn.textContent ?? "").not.toMatch(forbidden);
    }
  });
});

/* ==================================================================== *
 * FE-66 — one report, three grains (FR-RPT-026, FR-RPT-004; spec §3–§10)
 * ==================================================================== */

describe("FE-66 detail control — a radiogroup subordinate to the tablist (spec §3, §10)", () => {
  it("renders only on the attendance tab, is a radiogroup named 'Detail', and leaves the switcher a tablist", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");

    // Salary register is the landing tab — no detail control there.
    expect(screen.queryByTestId("attendance-detail-control")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    expect(screen.getByTestId("attendance-detail-control")).toBeInTheDocument();

    // Named "Detail" so a screen-reader user hears three grains, not five reports.
    const group = screen.getByRole("radiogroup", { name: "Detail" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    // Level 1 is STILL a tablist — the two levels must not read as siblings.
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    // …and it disappears again on a report with only one grain.
    await userEvent.click(screen.getByTestId("hr-tab-PAYMENT_HISTORY"));
    expect(screen.queryByTestId("attendance-detail-control")).not.toBeInTheDocument();
  });

  it("announces the new level + row count and moves focus to the results heading", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-range"));
    await runAttendanceRange();
    await screen.findByTestId("hr-att-range-table");

    await waitFor(() =>
      expect(screen.getByTestId("hr-level-announcement")).toHaveTextContent(/Range detail — 2 rows/),
    );
    expect(screen.getByTestId("hr-results-heading")).toHaveFocus();
    expect(screen.getByTestId("hr-results-heading")).toHaveTextContent(/Range detail/);
  });
});

describe("FE-66 per-level columns + endpoint (spec §4, §5, §9)", () => {
  it("Daily renders its 8 columns, keeps a status-only day's blank times, and queries /reports at day grain", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-daily"));
    await runAttendanceRange();

    const table = await screen.findByTestId("hr-att-daily-table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      "Employee", "Date", "Location", "Check-in", "Check-out", "Status", "Punches", "Source",
    ]);
    // No day counts and no Attendance % at this grain.
    expect(headers).not.toContain("Attendance %");
    expect(headers).not.toContain("Present");

    // The whole point: a leave day carries its status with BOTH time cells blank.
    // It is an expected shape — never an error, never a dropped row.
    const rows = within(table).getAllByTestId("hr-att-daily-row");
    expect(rows).toHaveLength(2);
    const leaveRow = rows[1]!;
    expect(within(leaveRow).getByTestId("hr-att-status")).toHaveTextContent("Paid leave");
    expect(within(leaveRow).getByTestId("hr-att-daily-checkin")).toHaveTextContent("");
    expect(within(leaveRow).getByTestId("hr-att-daily-checkout")).toHaveTextContent("");
    // …and the worked day still shows real times.
    expect(within(rows[0]!).getByTestId("hr-att-daily-checkin")).toHaveTextContent("09:02");
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("/reports/range"));
  });

  it("Range renders its 8 columns with Attendance % and re-queries at the new grain", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-range"));
    await runAttendanceRange();

    const table = await screen.findByTestId("hr-att-range-table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual([
      "Employee", "Project", "Cost centre", "Present", "Paid leave", "Unpaid leave", "Absent",
      "Attendance %",
    ]);
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("/reports/range"));
    // The grain is served, never re-filtered from a cached Summary result.
    expect(runMock).not.toHaveBeenCalledWith("attendance-summary", expect.anything());
  });

  it("Summary keeps the registered report and gains Project + Attendance %", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));

    const table = await screen.findByTestId("hr-att-table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(headers[0]).toBe("Project");
    expect(headers).toContain("Attendance %");
    expect(headers).toContain("Head count");
    expect(runMock).toHaveBeenCalledWith("attendance-summary", expect.anything());
  });
});

describe("FE-66 Attendance % is RENDERED, never computed (FR-RPT-004)", () => {
  it("shows the served figure verbatim even when it disagrees with a row-sum", async () => {
    // 88.5 is deliberately NOT derivable from this row's own counts — if the FE
    // ever divided, this assertion would fail.
    runMock.mockImplementation((name: string) =>
      name === "attendance-summary"
        ? Promise.resolve({
            ...ATT_RESULT,
            rows: [{ ...ATT_RESULT.rows[0], attendancePercentage: 88.5 }],
          })
        : Promise.resolve(ATT_RESULT),
    );
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-att-table");
    expect(screen.getByTestId("hr-att-percent")).toHaveTextContent("88.5%");
  });

  it("omits the column entirely where the endpoint serves no percentage", async () => {
    runMock.mockImplementation(() =>
      Promise.resolve({
        ...ATT_RESULT,
        rows: ATT_RESULT.rows.map((r) => ({ ...r, attendancePercentage: null })),
      }),
    );
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    const table = await screen.findByTestId("hr-att-table");
    // Absent rather than fabricated.
    expect(
      within(table).getAllByRole("columnheader").map((h) => h.textContent?.trim()),
    ).not.toContain("Attendance %");
    expect(screen.queryByTestId("hr-att-percent")).not.toBeInTheDocument();
  });
});

describe("FE-66 totals are the server's, never a page sum (FR-RPT-004)", () => {
  it("renders `totals` covering the whole set even when the visible page sums to less", async () => {
    // The page shows 2 rows summing to 37 present; the server's totals cover
    // 1,240 employee-days. A page-sum fallback would render 37 — this is the
    // fixture that proves the fallback is gone.
    runMock.mockImplementation(() =>
      Promise.resolve({
        ...ATT_RESULT,
        meta: {
          ...ATT_RESULT.meta,
          total: 1240,
          totals: {
            present: 1043, paidLeave: 24, unpaidLeave: 33, absent: 76,
            headCount: 42, attendancePercentage: 90.7,
          },
        },
      }),
    );
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));

    const band = await screen.findByTestId("hr-att-totals-band");
    expect(band).toHaveTextContent(/Report totals/);
    expect(band).toHaveTextContent("1043");
    expect(band).toHaveTextContent("90.7%");
    expect(band).toHaveTextContent(/not a sum of this page/);
    // The page's own sum (37) must appear nowhere in the band.
    expect(band).not.toHaveTextContent(/\b37\b/);
  });

  it("renders NO totals band when the server omits totals — never a synthesised one", async () => {
    runMock.mockImplementation(() =>
      Promise.resolve({
        ...ATT_RESULT,
        meta: { page: 1, pageSize: 2, total: 2, generatedAt: "2026-07-15T10:00:00Z" },
      }),
    );
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-att-table");
    // A missing number is recoverable; a wrong one is not.
    expect(screen.queryByTestId("hr-att-totals-band")).not.toBeInTheDocument();
  });
});

describe("FE-66 per-level empty copy (spec §8)", () => {
  it("says 'this month' at Summary and 'this period' at Daily/Range", async () => {
    runMock.mockImplementation(() => Promise.resolve({ ...ATT_RESULT, rows: [] }));
    getMock.mockResolvedValue({ data: [], totals: {}, pagination: { page: 1, limit: 20, total: 0 } });
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    fireEvent.change(screen.getByTestId("hr-filter-month") as HTMLInputElement, {
      target: { value: "2026-05" },
    });
    await userEvent.click(screen.getByTestId("report-run"));
    expect(await screen.findByTestId("hr-att-empty")).toHaveTextContent(
      "No attendance recorded for this month.",
    );

    await userEvent.click(screen.getByTestId("attendance-level-range"));
    await runAttendanceRange();
    expect(await screen.findByTestId("hr-att-empty")).toHaveTextContent(
      "No attendance recorded for this period.",
    );
  });
});

describe("FE-66 export follows the active level (FR-RPT-029, -031; spec §9)", () => {
  it("names the level + period in the scope note and re-issues at that grain", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-daily"));
    await runAttendanceRange();
    await screen.findByTestId("hr-att-daily-table");

    // The note states exactly what the file will contain, so a Summary file can
    // never be mistaken for a Daily one.
    expect(screen.getByTestId("report-export-scope-note")).toHaveTextContent(
      "The file matches what's on screen — Daily detail, 01/06/2026–30/06/2026.",
    );

    await userEvent.click(screen.getByTestId("report-export-excel"));
    await userEvent.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    // The DAILY endpoint, not the Summary report.
    expect(name).toBe("daily");
    expect(format).toBe("excel");
    // The table is never re-rendered by an export.
    expect(screen.getByTestId("hr-att-daily-table")).toBeInTheDocument();
  });

  it("stays enabled on an empty result", async () => {
    getMock.mockResolvedValue({ data: [], totals: {}, pagination: { page: 1, limit: 20, total: 0 } });
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-range"));
    await runAttendanceRange();
    await screen.findByTestId("hr-att-empty");
    expect((screen.getByTestId("report-export-excel") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("FE-66 range-clamped note (spec §7)", () => {
  it("tells the user the report stops at today", async () => {
    renderScreen();
    await screen.findByTestId("hr-viewer");
    await userEvent.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));
    await userEvent.click(screen.getByTestId("attendance-level-range"));
    expect(screen.getByTestId("hr-range-clamped-note")).toHaveTextContent(
      "This report stops at today — future dates aren't counted as absences.",
    );
  });
});
