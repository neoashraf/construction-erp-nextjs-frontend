/**
 * Attendance export — **owned by `/reports/hr`**, not by `/hr/attendance`.
 *
 * FE-64 removed the capture screen's Export mount and left the pointer link in its place;
 * **FE-66 completes the move** by making the report screen the only place an attendance file
 * comes from. Producing a file is a reporting concern (FR-RPT-026/-029/-031), so the download
 * moved rather than went away — and this file is REWRITTEN against the report screen per the
 * decision record §9, never deleted.
 *
 * Two halves, both required:
 *   1. **Ownership** — `/reports/hr` exports at the level on screen, and the capture screen
 *      offers no export control at all. Between those two facts there is no way to download
 *      attendance twice, and no way to download it at the wrong grain.
 *   2. **`ExportMenu`'s own defects** — the component is kept (it still serves the CSV path),
 *      and its real bugs stay covered: the items rendered as a run-together block because the
 *      shared `DropdownMenuItem` is a fixed-height single-line row, and both year pickers were
 *      capped to a window that made a year like 2028 unreachable.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/providers/session-provider";
import { type SafeUser } from "@/lib/auth/session";
import * as reportsApi from "@/features/reports/api/reports";
import * as mastersApi from "@/features/reports/api/masters";
import { HrReportsViewer } from "@/features/reports/hr/components/HrReportsViewer";
import { ExportMenu } from "@/features/hr/components/ExportMenu";
import { AttendanceLogFilterBar } from "@/features/hr/components/AttendanceLogFilterBar";
import { initialDraft } from "@/features/hr/lib/attendance-filters";

// Stub the network + the browser download so the test exercises the CLICK path only.
jest.mock("@/features/hr/api/attendance-logs", () => ({
  fetchExportCsv: jest.fn().mockResolvedValue("A,B\r\n1,2"),
}));
jest.mock("@/features/hr/lib/attendance-export", () => ({
  downloadCsvAsXlsx: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/features/reports/api/reports");
jest.mock("@/features/reports/api/masters");
jest.mock("@/lib/hooks/use-online", () => ({ useOnline: () => true }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
// Daily/Range read HR's own whole-body-envelope routes through `apiClient`.
jest.mock("@/lib/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const exportMock = reportsApi.exportReport as jest.Mock;
const getMock = (jest.requireMock("@/lib/api/client") as { apiClient: { get: jest.Mock } })
  .apiClient.get;

const HR_RANGE_BODY = {
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  totalWorkingDays: 25,
  totals: {
    totalEmployees: 2, workingDays: 25, presentCount: 45, absentCount: 2,
    paidLeaveCount: 2, unpaidLeaveCount: 0, attendancePercentage: 94.9,
  },
  data: [
    {
      id: "att-1", userId: "EMP-001", name: "Ashraf Uddin", designation: "Site Accountant",
      projectName: "Bridge-04 — Buriganga", costCentreName: "Superstructure / Deck",
      presentCount: 23, absentCount: 0, paidLeaveCount: 1, unpaidLeaveCount: 0,
      attendancePercentage: 100,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  unreconciled: { days: 0, reasons: {}, sample: [] },
};

function hrUser(): SafeUser {
  return {
    id: "u-1", name: "Farhana Yasmin", email: "farhana@zakirenterprise.com",
    role: "HR_MANAGER", companyId: "co-1", financialYearId: "fy-1", isActive: true,
    assignedProjectIds: [], grants: [],
  } as unknown as SafeUser;
}

beforeEach(() => {
  jest.clearAllMocks();
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "attendance-range.xlsx" });
  (reportsApi.saveBlob as jest.Mock).mockImplementation(() => undefined);
  (reportsApi.runReport as jest.Mock).mockResolvedValue({
    reportName: "attendance-summary", parameters: {}, rows: [],
    meta: { page: 1, pageSize: 25, total: 0, generatedAt: "2026-07-29T10:42:00Z" },
  });
  (mastersApi.listFinancialYearOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listEmployeeOptions as jest.Mock).mockResolvedValue([]);
  (mastersApi.listSalaryRunOptions as jest.Mock).mockResolvedValue([]);
  getMock.mockResolvedValue(HR_RANGE_BODY);
});

function renderHrReports() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={hrUser()}>
          <HrReportsViewer />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function renderExportMenu() {
  return render(
    <ToastProvider>
      <ExportMenu filters={{ dateFrom: "2026-07-01", dateTo: "2026-07-31" }} suggested="range" />
    </ToastProvider>,
  );
}

/* ------------------------------------------------------------------ *
 * 1. Ownership — the attendance download lives on /reports/hr (FE-66)
 * ------------------------------------------------------------------ */

describe("Attendance export ownership — /reports/hr (FR-RPT-029/-031)", () => {
  it("exports at the level on screen, naming that grain in the scope note", async () => {
    const user = userEvent.setup();
    renderHrReports();
    await screen.findByTestId("hr-viewer");
    await user.click(screen.getByTestId("hr-tab-ATTENDANCE_SUMMARY"));

    // Range is a different grain from the landing Summary — the export must follow.
    await user.click(screen.getByTestId("attendance-level-range"));
    fireEvent.change(screen.getByTestId("hr-filter-date-from") as HTMLInputElement, {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByTestId("hr-filter-date-to") as HTMLInputElement, {
      target: { value: "2026-06-30" },
    });
    await user.click(screen.getByTestId("report-run"));
    await screen.findByTestId("hr-att-range-table");

    expect(screen.getByTestId("report-export-scope-note")).toHaveTextContent(
      "The file matches what's on screen — Range detail, 01/06/2026–30/06/2026.",
    );

    await user.click(screen.getByTestId("report-export-excel"));
    await user.click(screen.getByTestId("report-export-run"));
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    const [name, , format] = exportMock.mock.calls[0]!;
    // The RANGE endpoint — never the Summary report the tab landed on.
    expect(name).toBe("range");
    expect(format).toBe("excel");
    // An export re-issues the query; it never re-renders the table.
    expect(screen.getByTestId("hr-att-range-table")).toBeInTheDocument();
  });

  it("is the ONLY attendance download — the capture screen offers no export control", () => {
    // The capture screen's own assertion lives in `attendance.test.tsx`; this is
    // the paired half, so the two sides of the move can never drift apart:
    // ExportMenu is not mounted by any HR capture component.
    const shell = readFileSync(
      require.resolve("@/features/hr/components/OfficeStaffPanel"),
      "utf8",
    );
    expect(shell).not.toMatch(/<ExportMenu/);
    // …and what it renders instead is the pointer to this report.
    expect(shell).toMatch(/Download attendance from Reports/);
  });
});

/* ------------------------------------------------------------------ *
 * 2. The kept component's own defects (decision record §9)
 * ------------------------------------------------------------------ */

describe("ExportMenu", () => {
  it("offers all three export types regardless of the current view", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Summary totals"),
      expect.stringContaining("Detailed day-by-day"),
      expect.stringContaining("Single day"),
    ]);
  });

  it("marks only the suggested type, without disabling the others", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const items = await screen.findAllByRole("menuitem");
    const suggested = items.filter((i) => within(i).queryByText("Suggested"));
    expect(suggested).toHaveLength(1);
    expect(suggested[0]).toHaveTextContent("Detailed day-by-day");
    for (const item of items) expect(item).not.toHaveAttribute("data-disabled");
  });

  it("lets each item grow to fit its two lines instead of the fixed row height", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    // h-auto must override the primitive's h-[34px], or label and hint collide.
    for (const item of await screen.findAllByRole("menuitem")) {
      expect(item.className).toContain("h-auto");
      expect(item.className).toContain("flex-col");
      expect(item.className).not.toMatch(/(^|\s)items-center(\s|$)/);
    }
  });

  it("renders the label above its hint, each on its own line", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const summary = (await screen.findAllByRole("menuitem"))[0]!;
    const label = within(summary).getByText("Summary totals");
    const hint = within(summary).getByText("One row per employee");
    // The hint must be quieter than the label — the original bug read as the reverse.
    expect(label.className).toContain("font-semibold");
    expect(hint.className).toContain("text-muted-foreground");
    expect(label.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("year picker", () => {
  it("can reach years well beyond the current one", async () => {
    const user = userEvent.setup();
    const onDraftChange = jest.fn();
    const draft = initialDraft(new Date(2026, 6, 15));
    render(
      <AttendanceLogFilterBar
        draft={draft}
        onDraftChange={onDraftChange}
        onModeChange={jest.fn()}
        onApply={jest.fn()}
        onClear={jest.fn()}
        onToggleSummary={jest.fn()}
        canSummarize
        showClear={false}
      />,
    );

    const yearSelect = screen.getByLabelText("Year");
    const options = within(yearSelect).getAllByRole("option").map((o) => o.textContent);
    // The reported gap: 2028 was simply not in the list.
    expect(options).toContain("2028");
    expect(options).toContain("2021");

    // Controlled select: picking 2028 reports the new month bounds upward.
    await user.selectOptions(yearSelect, "2028");
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: "2028-07-01", dateTo: "2028-07-31" }),
    );
  });
});

describe("ExportMenu — click behaviour", () => {
  const api = jest.requireMock("@/features/hr/api/attendance-logs") as {
    fetchExportCsv: jest.Mock;
  };

  it("actually calls the export endpoint when an item is chosen", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));
    await user.click(await screen.findByText("Summary totals"));

    await waitFor(() => expect(api.fetchExportCsv).toHaveBeenCalledTimes(1));
    expect(api.fetchExportCsv).toHaveBeenCalledWith(
      "summary",
      expect.objectContaining({ dateFrom: "2026-07-01", dateTo: "2026-07-31" }),
    );
  });
});
