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

const runMock = reportsApi.runReport as jest.Mock;
const exportMock = reportsApi.exportReport as jest.Mock;
const saveMock = reportsApi.saveBlob as jest.Mock;
const fyMock = mastersApi.listFinancialYearOptions as jest.Mock;
const projMock = mastersApi.listProjectOptions as jest.Mock;
const ccMock = mastersApi.listCostCentreOptions as jest.Mock;
const empMock = mastersApi.listEmployeeOptions as jest.Mock;
const runOptMock = mastersApi.listSalaryRunOptions as jest.Mock;

const ATT_RESULT = {
  reportName: "attendance-summary",
  parameters: { month: "2026-05" },
  rows: [
    { projectId: "proj-a", projectName: "Bridge-04", employeeId: "emp-1", employeeName: "Ashraf Uddin", partyId: null, partyName: null, costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", present: 22, paidLeave: 1, unpaidLeave: 0, absent: 3, headCount: 1, mode: "OFFICE" },
    { projectId: "proj-a", projectName: "Bridge-04", employeeId: "emp-gone", employeeName: null, partyId: null, partyName: null, costCentreId: "cc-1", costCentreCode: "CC-01", costCentreName: "Materials", present: 15, paidLeave: 0, unpaidLeave: 2, absent: 1, headCount: 1, mode: "OFFICE" },
  ],
  meta: { page: 1, pageSize: 2, total: 2, generatedAt: "2026-07-15T10:00:00Z", totals: { present: 37, paidLeave: 1, unpaidLeave: 2, absent: 4, headCount: 2 } },
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
});

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
    // Month totals footer visible.
    expect(screen.getByTestId("hr-att-totals-footer")).toHaveTextContent(/Month totals/);
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
});
