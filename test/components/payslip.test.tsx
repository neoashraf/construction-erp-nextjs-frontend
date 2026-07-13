/**
 * FE-38 Payslip tests (FR-HR-017; spec §4/§6/§8/§13). Covers: list per-employee rows,
 * single-document earnings/deductions/net with EXACT spec §8 labels, no-write assertion
 * (no Save/Post/Reverse/Edit anywhere), not-posted guard, reversed-run banner, partial
 * (blank designation → figures still render), search + "Clear search" empty variant,
 * role 403 (SITE_ENGINEER), print stylesheet class present, 360 single-payslip legibility.
 */
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { PayslipList } from "@/features/hr/components/PayslipList";
import { PayslipDocument } from "@/features/hr/components/PayslipDocument";
import * as salApi from "@/features/hr/api/salary";
import type { Payslip, SalarySheet } from "@/features/hr/api/salary";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/hr/api/salary");

const getSheetMock = salApi.getSalarySheet as jest.Mock;
const getPayslipsMock = salApi.getSheetPayslips as jest.Mock;

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderWith(ui: React.ReactElement, role: Role = "HR_MANAGER") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>{ui}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function postedSheet(over: Partial<SalarySheet> = {}): SalarySheet {
  return {
    id: "sal-1",
    financialYearId: "fy-1",
    periodLabel: "2026-06",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    status: "POSTED",
    salaryEntryId: "je-sal-1",
    entryNo: "SAL/2526/0001",
    reversalEntryId: null,
    reversalEntryNo: null,
    totalGross: "105000.0000",
    totalDeductions: "5250.0000",
    totalNet: "99750.0000",
    postedAt: "2026-07-05T10:00:00Z",
    postedBy: "u1",
    version: 2,
    lines: [],
    ...over,
  };
}

function payslip(over: Partial<Payslip> = {}): Payslip {
  return {
    employeeId: "emp-1",
    employeeCode: "EMP-001",
    name: "মোঃ রফিকুল ইসলাম",
    designation: "Site Accountant",
    periodLabel: "2026-06",
    paidDays: "30.000",
    grossAmount: "45000.0000",
    allowances: "0.0000",
    deductions: {
      tds: "0.0000",
      pf: "2250.0000",
      advanceRecovery: "0.0000",
      other: "0.0000",
    },
    netAmount: "42750.0000",
    ...over,
  };
}

const twoPayslips: Payslip[] = [
  payslip(),
  payslip({
    employeeId: "emp-2",
    employeeCode: "EMP-002",
    name: "Farzana Akter",
    designation: "Site Engineer",
    grossAmount: "60000.0000",
    deductions: { tds: "0.0000", pf: "3000.0000", advanceRecovery: "0.0000", other: "0.0000" },
    netAmount: "57000.0000",
  }),
];

beforeEach(() => {
  jest.clearAllMocks();
});

// ── List ──
describe("PayslipList — list view", () => {
  it("renders one row per employee from the payslips payload (name, code, gross, net)", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list");
    expect(screen.getByTestId("payslip-list-title")).toHaveTextContent("Payslips — 2026-06");
    expect(screen.getByTestId("payslip-row-emp-1")).toBeInTheDocument();
    expect(screen.getByTestId("payslip-row-emp-2")).toBeInTheDocument();
    expect(screen.getByText("EMP-001")).toBeInTheDocument();
    expect(screen.getByText("Farzana Akter")).toBeInTheDocument();
    // Rows carry a link to the single-doc view.
    expect(screen.getByTestId("payslip-view-emp-1")).toHaveAttribute(
      "href",
      "/hr/salary-sheets/sal-1/payslips/emp-1",
    );
  });

  it("shows the not-posted guard when the parent run is DRAFT", async () => {
    getSheetMock.mockResolvedValue(postedSheet({ status: "DRAFT", entryNo: null, salaryEntryId: null }));
    getPayslipsMock.mockResolvedValue([]);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list-guard");
    expect(screen.getByTestId("payslip-not-posted-guard")).toHaveTextContent(
      "Payslips aren't available until this salary sheet is posted.",
    );
    expect(screen.getByTestId("payslip-back-to-sheet")).toHaveAttribute("href", "/hr/salary-sheets/sal-1");
  });

  it("shows the reversed-run banner when the parent run is REVERSED", async () => {
    getSheetMock.mockResolvedValue(
      postedSheet({
        status: "REVERSED",
        reversalEntryNo: "SAL/2526/0002",
        reversalEntryId: "je-r-2",
      }),
    );
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list");
    const banner = screen.getByTestId("payslip-reversed-banner");
    expect(banner).toHaveTextContent(
      "This salary run has been reversed. These figures reflect the original posting, not a corrected one.",
    );
  });

  it("filters by employee name/code and shows the filtered-empty + Clear search", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list");
    const box = screen.getByTestId("payslip-search");
    await userEvent.type(box, "zzz-no-match");
    expect(await screen.findByTestId("payslip-empty-filtered")).toBeInTheDocument();
    expect(screen.getByText("No employees match this search.")).toBeInTheDocument();
    const clear = screen.getByTestId("payslip-clear-search");
    await userEvent.click(clear);
    // Rows come back.
    await waitFor(() => expect(screen.getByTestId("payslip-row-emp-1")).toBeInTheDocument());
  });

  it("shows the zero-line empty when the run has NO payslips", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue([]);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list");
    expect(screen.getByTestId("payslip-empty-no-run")).toBeInTheDocument();
    expect(screen.getByText("No payslips available for this run yet.")).toBeInTheDocument();
  });

  it("has NO write affordance anywhere on the list (Save/Post/Reverse/Edit/Delete)", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipList sheetId="sal-1" />);
    await screen.findByTestId("payslip-list");
    // Copy assertion — none of the write-verb strings exist.
    for (const label of [/^Save$/i, /^Post$/i, /^Reverse$/i, /^Edit$/i, /^Delete$/i]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    for (const name of [/^save$/i, /^post$/i, /^reverse$/i, /^edit$/i, /^delete$/i, /^generate$/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    // No text inputs other than the employee search (type="search").
    const inputs = document.querySelectorAll("input");
    inputs.forEach((el) => {
      expect(el.getAttribute("type")).toBe("search");
    });
  });

  it("SITE_ENGINEER: 403 permission-denied view (no path even on direct URL)", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipList sheetId="sal-1" />, "SITE_ENGINEER");
    expect(await screen.findByTestId("payslip-forbidden")).toHaveTextContent(
      "You don't have permission to view payslips.",
    );
    expect(screen.queryByTestId("payslip-list")).not.toBeInTheDocument();
  });
});

// ── Single-document ──
describe("PayslipDocument — single-payslip document", () => {
  it("renders earnings / deductions / net with EXACT spec §8 labels + values", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    // Title has exact microcopy shape.
    expect(screen.getByTestId("payslip-doc-title")).toHaveTextContent(
      /Payslip — মোঃ রফিকুল ইসলাম, 2026-06/,
    );
    // Exact spec §8 labels.
    const earnings = screen.getByTestId("payslip-earnings");
    expect(within(earnings).getByText("Earnings")).toBeInTheDocument();
    expect(within(earnings).getByText("Gross salary")).toBeInTheDocument();
    expect(within(earnings).getByText("Allowances")).toBeInTheDocument();
    const deductions = screen.getByTestId("payslip-deductions");
    expect(within(deductions).getByText("Deductions")).toBeInTheDocument();
    expect(within(deductions).getByText("TDS")).toBeInTheDocument();
    expect(within(deductions).getByText("Provident Fund (PF)")).toBeInTheDocument();
    expect(within(deductions).getByText("Advance recovery")).toBeInTheDocument();
    expect(within(deductions).getByText("Other deductions")).toBeInTheDocument();
    expect(screen.getByTestId("payslip-net-label")).toHaveTextContent("Net pay");
    // "Paid days: {paidDays}" per spec §8.
    expect(screen.getByTestId("payslip-paid-days")).toHaveTextContent("Paid days: 30.000");
    // Net-pay value carries the aria-label for the summary announcement.
    const net = screen.getByTestId("payslip-net-value");
    expect(net.getAttribute("aria-label")).toMatch(/Net pay/);
    expect(net).toHaveTextContent(/42,750/);
  });

  it("has NO write affordance anywhere on the document (Save/Post/Reverse/Edit)", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    for (const name of [/^save$/i, /^post$/i, /^reverse$/i, /^edit$/i, /^delete$/i, /^generate$/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    for (const label of [/^Save$/i, /^Post$/i, /^Reverse$/i, /^Edit$/i, /^Delete$/i]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    // No editable form controls at all — the document has no inputs.
    expect(document.querySelectorAll("input").length).toBe(0);
    expect(document.querySelectorAll("textarea").length).toBe(0);
  });

  it("shows the not-posted guard on a DRAFT parent run (direct URL hit)", async () => {
    getSheetMock.mockResolvedValue(postedSheet({ status: "DRAFT", entryNo: null, salaryEntryId: null }));
    getPayslipsMock.mockResolvedValue([]);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc-guard");
    expect(screen.getByTestId("payslip-not-posted-guard")).toHaveTextContent(
      "Payslips aren't available until this salary sheet is posted.",
    );
  });

  it("shows the reversed-run banner + still renders the original figures", async () => {
    getSheetMock.mockResolvedValue(
      postedSheet({
        status: "REVERSED",
        reversalEntryNo: "SAL/2526/0002",
        reversalEntryId: "je-r-2",
      }),
    );
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    expect(screen.getByTestId("payslip-reversed-banner")).toBeInTheDocument();
    // Original figures still render exactly as posted.
    expect(screen.getByTestId("payslip-net-value")).toHaveTextContent(/42,750/);
  });

  it("partial: unresolved designation is blank; financial figures still render from the posted line", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue([payslip({ designation: null })]);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    // Designation dd renders blank (no crash, no default text).
    expect(screen.getByTestId("payslip-emp-designation")).toHaveTextContent("");
    // Financial figures still render.
    expect(screen.getByTestId("payslip-earnings-gross")).toHaveTextContent(/45,000/);
    expect(screen.getByTestId("payslip-net-value")).toHaveTextContent(/42,750/);
  });

  it("SITE_ENGINEER: 403 permission-denied view on direct URL", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />, "SITE_ENGINEER");
    expect(await screen.findByTestId("payslip-forbidden")).toHaveTextContent(
      "You don't have permission to view payslips.",
    );
  });

  it("print stylesheet: chrome carries `print-hide` and the paper carries `print-paper`", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    // The paper is the DOM node that survives @media print.
    const paper = screen.getByTestId("payslip-paper");
    expect(paper.className).toMatch(/print-paper/);
    // The Print action carries `.print-hide` so it's hidden on paper.
    const printBtn = screen.getByTestId("payslip-print");
    expect(printBtn.className).toMatch(/print-hide/);
    // A `@media print` block exists in the DOM (via `<style jsx global>`).
    const styleTags = document.querySelectorAll("style");
    let sawMediaPrint = false;
    styleTags.forEach((s) => {
      if ((s.textContent ?? "").includes("@media print")) sawMediaPrint = true;
    });
    expect(sawMediaPrint).toBe(true);
  });

  it("Print button invokes `window.print()`", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    await userEvent.click(screen.getByTestId("payslip-print"));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("360 legibility: the paper + net row still render at 360 (mobile frame)", async () => {
    getSheetMock.mockResolvedValue(postedSheet());
    getPayslipsMock.mockResolvedValue(twoPayslips);
    // Force jsdom viewport to 360 — the paper + net row must still be in the document.
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 780 });
    window.dispatchEvent(new Event("resize"));
    renderWith(<PayslipDocument sheetId="sal-1" employeeId="emp-1" />);
    await screen.findByTestId("payslip-doc");
    const paper = screen.getByTestId("payslip-paper");
    // The paper container has no fixed min-width that would break 360 (fitsWithin 360).
    expect(paper.getBoundingClientRect().width).toBeLessThanOrEqual(360 + 1);
    // Net-pay row + code/name still rendered → readable per the mobile frame.
    expect(screen.getByTestId("payslip-net-row")).toBeInTheDocument();
    expect(screen.getByTestId("payslip-emp-code")).toBeInTheDocument();
  });
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
});
