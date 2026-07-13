/**
 * Local seed for the Salary Sheet screen — the fictional runs register + the 2026-06
 * DRAFT run's 10 editable lines from `Salary Sheet.dc.html`, typed as the real
 * `SalarySheet` / `SalarySheetLine` shapes. Distinct from `payroll.ts` (which seeds the
 * posted June-2025 payslip run) so each screen stays faithful to its own mockup.
 * Realistic but fictional — no real PII.
 */

import Decimal from "decimal.js";
import { type SalarySheet, type SalarySheetLine } from "../types";

const money = (n: number): string => new Decimal(n).toFixed(4);

/** An editable draft line as authored in the mockup (`pfApplicable` gates the PF cell). */
export interface DraftLine extends SalarySheetLine {
  pfApplicable: boolean;
}

interface RawLine {
  id: string;
  code: string;
  name: string;
  project: string;
  paid: number;
  gross: number;
  allowances: number;
  tds: number;
  pf: number;
  pfApplicable: boolean;
  advance: number;
  other: number;
}

/** The 2026-06 DRAFT run's 10 lines (verbatim values from the mockup). */
const RAW: RawLine[] = [
  { id: "l1", code: "EMP-0001", name: "Ashraf Uddin", project: "Bridge-04 — Buriganga", paid: 26, gross: 42000, allowances: 3000, tds: 1200, pf: 2100, pfApplicable: true, advance: 5000, other: 0 },
  { id: "l2", code: "EMP-0002", name: "ফারজানা আক্তার", project: "Tower-A", paid: 26, gross: 55000, allowances: 4000, tds: 2500, pf: 2750, pfApplicable: true, advance: 0, other: 500 },
  { id: "l3", code: "EMP-0003", name: "Mohammad Hasan", project: "Bridge-04 — Buriganga", paid: 24, gross: 38000, allowances: 2000, tds: 900, pf: 0, pfApplicable: false, advance: 3000, other: 0 },
  { id: "l4", code: "EMP-0004", name: "Imran Chowdhury", project: "Tower-A", paid: 26, gross: 48000, allowances: 3500, tds: 1800, pf: 2400, pfApplicable: true, advance: 0, other: 0 },
  { id: "l5", code: "EMP-0005", name: "রুবেল মিয়া", project: "Bridge-04 — Buriganga", paid: 25, gross: 35000, allowances: 1500, tds: 700, pf: 0, pfApplicable: false, advance: 2000, other: 0 },
  { id: "l6", code: "EMP-0006", name: "Kamrul Islam", project: "Tower-A", paid: 26, gross: 44000, allowances: 3000, tds: 1500, pf: 2200, pfApplicable: true, advance: 4000, other: 250 },
  { id: "l7", code: "EMP-0007", name: "Nusrat Jahan", project: "Bridge-04 — Buriganga", paid: 26, gross: 40000, allowances: 2500, tds: 1100, pf: 2000, pfApplicable: true, advance: 0, other: 0 },
  { id: "l8", code: "EMP-0008", name: "Tanvir Ahmed", project: "Tower-A", paid: 23, gross: 36000, allowances: 1800, tds: 800, pf: 0, pfApplicable: false, advance: 2500, other: 0 },
  { id: "l9", code: "EMP-0009", name: "সাব্বির রহমান", project: "Bridge-04 — Buriganga", paid: 26, gross: 52000, allowances: 4000, tds: 2300, pf: 2600, pfApplicable: true, advance: 0, other: 400 },
  { id: "l10", code: "EMP-0010", name: "Rezaul Karim", project: "Tower-A", paid: 26, gross: 46000, allowances: 3200, tds: 1600, pf: 2300, pfApplicable: true, advance: 3000, other: 0 },
];

const netOf = (r: RawLine): number =>
  r.gross + r.allowances - (r.tds + r.pf + r.advance + r.other);

/** The editable 2026-06 draft lines. */
export const DRAFT_LINES_SEED: DraftLine[] = RAW.map((r) => ({
  id: r.id,
  employeeCode: r.code,
  employeeName: r.name,
  designation: "", // the mockup identity is name + code; no designation column
  projectName: r.project,
  paidDays: r.paid,
  grossAmount: money(r.gross),
  allowances: money(r.allowances),
  tds: money(r.tds),
  pf: money(r.pf),
  advanceRecovery: money(r.advance),
  otherDeductions: money(r.other),
  netAmount: money(netOf(r)),
  pfApplicable: r.pfApplicable,
}));

/** The runs register (7 rows) — one DRAFT + posted + one reversed. */
export const SALARY_RUNS_SEED: SalarySheet[] = [
  { id: "2026-06", periodLabel: "2026-06", periodStart: "2026-06-01", periodEnd: "2026-06-30", status: "DRAFT", salaryEntryNo: null, employeeCount: 10, totalGross: money(464200), totalDeductions: money(78300), totalNet: money(385900), version: 1 },
  { id: "2026-05", periodLabel: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", status: "POSTED", salaryEntryNo: "SAL-2026-00006", employeeCount: 10, totalGross: money(458000), totalDeductions: money(75600), totalNet: money(382400), version: 2 },
  { id: "2026-04", periodLabel: "2026-04", periodStart: "2026-04-01", periodEnd: "2026-04-30", status: "POSTED", salaryEntryNo: "SAL-2026-00005", employeeCount: 10, totalGross: money(449500), totalDeductions: money(73100), totalNet: money(376400), version: 2 },
  { id: "2026-03", periodLabel: "2026-03", periodStart: "2026-03-01", periodEnd: "2026-03-31", status: "POSTED", salaryEntryNo: "SAL-2026-00004", employeeCount: 10, totalGross: money(441000), totalDeductions: money(71800), totalNet: money(369200), version: 2 },
  { id: "2026-02", periodLabel: "2026-02", periodStart: "2026-02-01", periodEnd: "2026-02-28", status: "REVERSED", salaryEntryNo: "SAL-2026-00003", employeeCount: 10, totalGross: money(438600), totalDeductions: money(70900), totalNet: money(367700), version: 3 },
  { id: "2026-01", periodLabel: "2026-01", periodStart: "2026-01-01", periodEnd: "2026-01-31", status: "POSTED", salaryEntryNo: "SAL-2026-00002", employeeCount: 10, totalGross: money(435200), totalDeductions: money(69400), totalNet: money(365800), version: 2 },
  { id: "2025-12", periodLabel: "2025-12", periodStart: "2025-12-01", periodEnd: "2025-12-31", status: "POSTED", salaryEntryNo: "SAL-2026-00001", employeeCount: 10, totalGross: money(429000), totalDeductions: money(68100), totalNet: money(360900), version: 2 },
];

/** The reversal entry that reversed the 2026-02 run (for the reversed-run view). */
export const REVERSED_BY: Record<string, string> = { "2026-02": "SAL-2026-00011" };
