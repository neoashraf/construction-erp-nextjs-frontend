/**
 * Local seed for the salary + payslip surfaces — the fictional June-2025 posted run
 * from `Salary Sheet.dc.html` / `Payslip.dc.html`, typed as the real `SalarySheetLine`
 * / `Payslip` shapes. One dataset feeds both: a salary line and its payslip are the
 * same immutable figures captured at posting (API contract 12 §Salary/Payslip).
 * Realistic but fictional — no real PII.
 */

import Decimal from "decimal.js";
import { type Payslip, type SalarySheet, type SalarySheetLine } from "../types";

/** One row of the raw June-2025 dataset (as authored in the mockup). */
interface Row {
  code: string;
  name: string;
  designation: string;
  project: string | null;
  paidDays: number;
  gross: number;
  allow: number;
  tds: number;
  pf: number;
  adv: number;
  other: number;
}

/** The 15 posted-run rows (codes intentionally skip EMP-0011 / EMP-0015). */
const ROWS: Row[] = [
  { code: "EMP-0001", name: "Ashraf Uddin", designation: "Project Engineer", project: "Bridge-04 — Buriganga", paidDays: 30, gross: 95000, allow: 15000, tds: 5200, pf: 5700, adv: 0, other: 2000 },
  { code: "EMP-0002", name: "ফারজানা আক্তার", designation: "Accounts Officer", project: "Tower-A — Gulshan", paidDays: 30, gross: 68000, allow: 12000, tds: 3400, pf: 4080, adv: 5000, other: 1200 },
  { code: "EMP-0003", name: "Mohammad Hasan", designation: "Quantity Surveyor", project: "Tower-A — Gulshan", paidDays: 30, gross: 82000, allow: 13000, tds: 4100, pf: 4920, adv: 0, other: 1500 },
  { code: "EMP-0004", name: "Imran Chowdhury", designation: "Site Supervisor", project: "Bridge-04 — Buriganga", paidDays: 28, gross: 42000, allow: 6000, tds: 0, pf: 2520, adv: 3000, other: 800 },
  { code: "EMP-0005", name: "Nazia Rahman", designation: "Admin Officer", project: null, paidDays: 30, gross: 55000, allow: 9000, tds: 2200, pf: 3300, adv: 0, other: 1000 },
  { code: "EMP-0006", name: "রুবেল মিয়া", designation: "Store Officer", project: "Road-12 — Savar", paidDays: 30, gross: 42000, allow: 6500, tds: 0, pf: 2520, adv: 2000, other: 600 },
  { code: "EMP-0007", name: "Kamrul Islam", designation: "Land Surveyor", project: "Tower-A — Gulshan", paidDays: 26, gross: 37500, allow: 5000, tds: 0, pf: 2250, adv: 0, other: 500 },
  { code: "EMP-0008", name: "Sajid Karim", designation: "Procurement Officer", project: null, paidDays: 30, gross: 74000, allow: 11000, tds: 3700, pf: 4440, adv: 0, other: 1300 },
  { code: "EMP-0009", name: "তানভীর আহমেদ", designation: "Draftsman", project: null, paidDays: 30, gross: 48000, allow: 7000, tds: 1400, pf: 2880, adv: 0, other: 700 },
  { code: "EMP-0010", name: "Shirin Sultana", designation: "HR Executive", project: null, paidDays: 30, gross: 52000, allow: 8000, tds: 2000, pf: 3120, adv: 0, other: 900 },
  { code: "EMP-0012", name: "Habibur Rahman", designation: "Senior Accountant", project: null, paidDays: 30, gross: 88000, allow: 14000, tds: 4600, pf: 5280, adv: 0, other: 1800 },
  { code: "EMP-0013", name: "মাহমুদা খাতুন", designation: "Office Assistant", project: null, paidDays: 30, gross: 32000, allow: 4500, tds: 0, pf: 1920, adv: 1500, other: 400 },
  { code: "EMP-0014", name: "Rafiqul Islam", designation: "Site Engineer", project: "Road-12 — Savar", paidDays: 29, gross: 78000, allow: 12000, tds: 3900, pf: 4680, adv: 0, other: 1400 },
  { code: "EMP-0016", name: "Anwar Hossain", designation: "Foreman", project: "Plant-02 — Ashulia", paidDays: 30, gross: 46000, allow: 7000, tds: 0, pf: 2760, adv: 2500, other: 700 },
  { code: "EMP-0017", name: "Sabbir Ahmed", designation: "Junior Accountant", project: null, paidDays: 30, gross: 38000, allow: 5500, tds: 1100, pf: 2280, adv: 0, other: 600 },
];

const money = (n: number): string => new Decimal(n).toFixed(4);
/** net = gross + allowances − (tds + pf + advance + other). */
const netOf = (r: Row): number => r.gross + r.allow - (r.tds + r.pf + r.adv + r.other);

/** Convert an integer taka amount to English words ("… taka only"). */
export function takaInWords(n: number): string {
  if (n === 0) return "Zero taka only";
  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const one = (x: number): string => ones[x] ?? "";
  const ten = (x: number): string => tens[x] ?? "";
  const twoDigits = (x: number): string =>
    x < 20 ? one(x) : `${ten(Math.floor(x / 10))}${x % 10 ? "-" + one(x % 10) : ""}`;
  const threeDigits = (x: number): string => {
    const h = Math.floor(x / 100);
    const rest = x % 100;
    return `${h ? `${one(h)} hundred${rest ? " " : ""}` : ""}${rest ? twoDigits(rest) : ""}`;
  };
  // Bangladeshi numbering: crore, lakh, thousand, hundred.
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const below = n % 1000;
  if (crore) parts.push(`${twoDigits(crore)} crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} thousand`);
  if (below) parts.push(threeDigits(below));
  const words = parts.join(" ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} taka only`;
}

export const PAYROLL_PERIOD = {
  label: "June 2025",
  periodLabel: "2025-06",
  periodStart: "2025-06-01",
  periodEnd: "2025-06-30",
  postedOn: "2025-07-02",
  workingDays: 30,
  entryNo: "SAL-2025-00006",
};

/** Salary lines for the posted June-2025 sheet (FR-HR-014). */
export const SALARY_LINES_SEED: SalarySheetLine[] = ROWS.map((r, i) => ({
  id: `sl-${i + 1}`,
  employeeCode: r.code,
  employeeName: r.name,
  designation: r.designation,
  projectName: r.project,
  paidDays: r.paidDays,
  grossAmount: money(r.gross),
  allowances: money(r.allow),
  tds: money(r.tds),
  pf: money(r.pf),
  advanceRecovery: money(r.adv),
  otherDeductions: money(r.other),
  netAmount: money(netOf(r)),
}));

const sum = (pick: (r: Row) => number): string =>
  money(ROWS.reduce((acc, r) => acc + pick(r), 0));

/** The salary-sheet register (FR-HR-013): one posted June run + a couple of others. */
export const SALARY_SHEETS_SEED: SalarySheet[] = [
  {
    id: "sh-2025-06",
    periodLabel: "2025-06",
    periodStart: "2025-06-01",
    periodEnd: "2025-06-30",
    status: "POSTED",
    salaryEntryNo: PAYROLL_PERIOD.entryNo,
    employeeCount: ROWS.length,
    totalGross: sum((r) => r.gross + r.allow),
    totalDeductions: sum((r) => r.tds + r.pf + r.adv + r.other),
    totalNet: sum(netOf),
    version: 2,
  },
  {
    id: "sh-2025-07",
    periodLabel: "2025-07",
    periodStart: "2025-07-01",
    periodEnd: "2025-07-31",
    status: "DRAFT",
    salaryEntryNo: null,
    employeeCount: ROWS.length,
    totalGross: sum((r) => r.gross + r.allow),
    totalDeductions: sum((r) => r.tds + r.pf + r.adv + r.other),
    totalNet: sum(netOf),
    version: 1,
  },
  {
    id: "sh-2025-05",
    periodLabel: "2025-05",
    periodStart: "2025-05-01",
    periodEnd: "2025-05-31",
    status: "POSTED",
    salaryEntryNo: "SAL-2025-00005",
    employeeCount: ROWS.length,
    totalGross: sum((r) => r.gross + r.allow),
    totalDeductions: sum((r) => r.tds + r.pf + r.adv + r.other),
    totalNet: sum(netOf),
    version: 3,
  },
];

/** Payslips for the posted June run (FR-HR-017) — same figures as the salary lines. */
export const PAYSLIPS_SEED: Payslip[] = ROWS.map((r) => {
  const gross = r.gross + r.allow;
  const deductions = r.tds + r.pf + r.adv + r.other;
  const net = netOf(r);
  return {
    employeeCode: r.code,
    name: r.name,
    designation: r.designation,
    department: null,
    bankName: null,
    bankAccountNoMasked: null,
    periodLabel: PAYROLL_PERIOD.label,
    paidDays: r.paidDays,
    workingDays: PAYROLL_PERIOD.workingDays,
    wageType: "MONTHLY",
    basicSalary: money(r.gross),
    allowances: money(r.allow),
    overtime: money(0),
    grossAmount: money(gross),
    tds: money(r.tds),
    pf: money(r.pf),
    advanceRecovery: money(r.adv),
    otherDeductions: money(r.other),
    totalDeductions: money(deductions),
    netAmount: money(net),
    netInWords: takaInWords(net),
  };
});
