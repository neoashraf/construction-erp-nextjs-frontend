/**
 * Local seed for the Employees master — the fictional Bangladeshi sample data from
 * `Employees.dc.html`, typed as the real `Employee` shape. Screens read this in
 * place of `GET /api/hr/employees` for now; swapping to the live endpoint is a
 * one-line change in the hooks. Realistic but fictional — no real PII.
 */

import { type Employee, type EmployeeAssignment } from "../types";

/** Wage amounts are `Decimal(18,4)` strings — never JS floats (CLAUDE.md exact money). */
function money(n: number): string {
  return n.toFixed(4);
}

export const EMPLOYEES_SEED: Employee[] = [
  {
    id: "e1", employeeCode: "EMP-0001", name: "Ashraf Uddin", designation: "Project Engineer",
    department: "Engineering", defaultProjectId: "Bridge-04 — Buriganga", workBase: "SITE",
    wageType: "MONTHLY", wageAmount: money(95000), bankName: "BRAC Bank — Motijheel Branch",
    bankAccountNameMasked: "•••••• Uddin", bankAccountNoMasked: "•••• •••• 3391",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false, tin: "217834561290",
    joiningDate: "2022-01-10", status: "ACTIVE", version: 4,
  },
  {
    id: "e2", employeeCode: "EMP-0002", name: "ফারজানা আক্তার", designation: "Accounts Officer",
    department: "Accounts", defaultProjectId: "Tower-A — Gulshan", workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(68000), bankName: "BRAC Bank — Gulshan Branch",
    bankAccountNameMasked: "•••••• আক্তার", bankAccountNoMasked: "•••• •••• 4821",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false, tin: "456912378905",
    joiningDate: "2023-03-12", status: "ACTIVE", version: 3,
  },
  {
    id: "e3", employeeCode: "EMP-0003", name: "Mohammad Hasan", designation: "Quantity Surveyor",
    department: "Engineering", defaultProjectId: "Tower-A — Gulshan", workBase: "SITE",
    wageType: "MONTHLY", wageAmount: money(82000), bankName: "Dutch-Bangla Bank",
    bankAccountNameMasked: "•••••• Hasan", bankAccountNoMasked: "•••• •••• 1177",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false, tin: "334521908766",
    joiningDate: "2022-07-01", status: "ACTIVE", version: 2,
  },
  {
    id: "e4", employeeCode: "EMP-0004", name: "Imran Chowdhury", designation: "Site Supervisor",
    department: "Operations", defaultProjectId: "Bridge-04 — Buriganga", workBase: "SITE",
    wageType: "DAILY", wageAmount: money(1400), bankName: "Islami Bank Bangladesh",
    bankAccountNameMasked: "•••••• Chowdhury", bankAccountNoMasked: "•••• •••• 9042",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2024-02-15", status: "ACTIVE", version: 1,
  },
  {
    id: "e5", employeeCode: "EMP-0005", name: "Nazia Rahman", designation: "Admin Officer",
    department: "Administration", defaultProjectId: null, workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(55000), bankName: "City Bank",
    bankAccountNameMasked: "•••••• Rahman", bankAccountNoMasked: "•••• •••• 6610",
    pfApplicable: true, gratuityApplicable: false, wppfApplicable: false, tin: "129834765412",
    joiningDate: "2023-09-05", status: "ACTIVE", version: 2,
  },
  {
    id: "e6", employeeCode: "EMP-0006", name: "রুবেল মিয়া", designation: "Store Officer",
    department: "Stores", defaultProjectId: "Road-12 — Savar", workBase: "SITE",
    wageType: "MONTHLY", wageAmount: money(42000), bankName: "Sonali Bank",
    bankAccountNameMasked: "•••••• মিয়া", bankAccountNoMasked: "•••• •••• 2288",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2024-05-20", status: "ACTIVE", version: 1,
  },
  {
    id: "e7", employeeCode: "EMP-0007", name: "Kamrul Islam", designation: "Land Surveyor",
    department: "Engineering", defaultProjectId: "Tower-A — Gulshan", workBase: "SITE",
    wageType: "DAILY", wageAmount: money(1250), bankName: "Dutch-Bangla Bank",
    bankAccountNameMasked: "•••••• Islam", bankAccountNoMasked: "•••• •••• 7733",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2023-11-11", status: "ACTIVE", version: 1,
  },
  {
    id: "e8", employeeCode: "EMP-0008", name: "Sajid Karim", designation: "Procurement Officer",
    department: "Procurement", defaultProjectId: null, workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(74000), bankName: "Eastern Bank",
    bankAccountNameMasked: "•••••• Karim", bankAccountNoMasked: "•••• •••• 5501",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false, tin: "778213456099",
    joiningDate: "2021-06-30", status: "ACTIVE", version: 5,
  },
  {
    id: "e9", employeeCode: "EMP-0009", name: "তানভীর আহমেদ", designation: "Draftsman",
    department: "Engineering", defaultProjectId: "FAIL:PRJ-1043", workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(48000), bankName: "BRAC Bank",
    bankAccountNameMasked: "•••••• আহমেদ", bankAccountNoMasked: "•••• •••• 8890",
    pfApplicable: true, gratuityApplicable: false, wppfApplicable: false, tin: "561209384712",
    joiningDate: "2023-04-18", status: "ACTIVE", version: 2,
  },
  {
    id: "e10", employeeCode: "EMP-0010", name: "Shirin Sultana", designation: "HR Executive",
    department: "Human Resources", defaultProjectId: null, workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(52000), bankName: "City Bank",
    bankAccountNameMasked: "•••••• Sultana", bankAccountNoMasked: "•••• •••• 3322",
    pfApplicable: true, gratuityApplicable: false, wppfApplicable: false, tin: "902348765123",
    joiningDate: "2023-08-01", status: "ACTIVE", version: 1,
  },
  {
    id: "e11", employeeCode: "EMP-0011", name: "Abdul Malek", designation: "Site Electrician",
    department: "Operations", defaultProjectId: "Plant-02 — Ashulia", workBase: "SITE",
    wageType: "DAILY", wageAmount: money(1100), bankName: "Agrani Bank",
    bankAccountNameMasked: "•••••• Malek", bankAccountNoMasked: "•••• •••• 4409",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2023-02-01", status: "INACTIVE", version: 3,
  },
  {
    id: "e12", employeeCode: "EMP-0012", name: "Habibur Rahman", designation: "Senior Accountant",
    department: "Accounts", defaultProjectId: null, workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(88000), bankName: "BRAC Bank — Motijheel Branch",
    bankAccountNameMasked: "•••••• Rahman", bankAccountNoMasked: "•••• •••• 1290",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: true, tin: "445298137006",
    joiningDate: "2020-10-12", status: "ACTIVE", version: 6,
  },
  {
    id: "e13", employeeCode: "EMP-0013", name: "মাহমুদা খাতুন", designation: "Office Assistant",
    department: "Administration", defaultProjectId: null, workBase: "HEAD_OFFICE",
    wageType: "MONTHLY", wageAmount: money(32000), bankName: "Sonali Bank",
    bankAccountNameMasked: "•••••• খাতুন", bankAccountNoMasked: "•••• •••• 6644",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2024-01-07", status: "ACTIVE", version: 1,
  },
  {
    id: "e14", employeeCode: "EMP-0014", name: "Rafiqul Islam", designation: "Site Engineer",
    department: "Engineering", defaultProjectId: "Road-12 — Savar", workBase: "SITE",
    wageType: "MONTHLY", wageAmount: money(78000), bankName: "Dutch-Bangla Bank",
    bankAccountNameMasked: "•••••• Islam", bankAccountNoMasked: "•••• •••• 7012",
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false, tin: "123456789012",
    joiningDate: "2022-03-01", status: "INACTIVE", version: 4,
  },
  {
    id: "e15", employeeCode: "EMP-0015", name: "Delwar Hossain", designation: "Driver",
    department: "Operations", defaultProjectId: "Bridge-04 — Buriganga", workBase: "SITE",
    wageType: "DAILY", wageAmount: money(950), bankName: "Janata Bank",
    bankAccountNameMasked: "•••••• Hossain", bankAccountNoMasked: "•••• •••• 5580",
    pfApplicable: false, gratuityApplicable: false, wppfApplicable: false, tin: null,
    joiningDate: "2023-12-01", status: "INACTIVE", version: 2,
  },
];

/**
 * Append-only assignment history keyed by employee id (FR-HR-002). Only the detail
 * sample (EMP-0002) carries a real trail in the mockup; others fall back to a single
 * joining entry synthesised in the hook.
 */
export const ASSIGNMENTS_SEED: Record<string, EmployeeAssignment[]> = {
  e2: [
    {
      id: "a1", employeeId: "e2", projectName: "Tower-A — Gulshan", effectiveDate: "2025-07-01",
      note: "টাওয়ার-এ সাইট অফিসে বদলি — site accounts support for the fit-out phase.",
      isCurrent: true, isJoining: false,
    },
    {
      id: "a2", employeeId: "e2", projectName: "Bridge-04 — Buriganga", effectiveDate: "2024-09-15",
      note: "Site accounts support during the IPC-07 retention audit.",
      isCurrent: false, isJoining: false,
    },
    {
      id: "a3", employeeId: "e2", projectName: "Head Office", effectiveDate: "2023-03-12",
      note: "Initial assignment on joining.", isCurrent: false, isJoining: true,
    },
  ],
};

/** The selectable default-project options (FR-HR-001 default-tagging convenience). */
export const PROJECT_OPTIONS: { id: string; label: string }[] = [
  { id: "Tower-A — Gulshan", label: "Tower-A — Gulshan" },
  { id: "Bridge-04 — Buriganga", label: "Bridge-04 — Buriganga" },
  { id: "Road-12 — Savar", label: "Road-12 — Savar" },
  { id: "Plant-02 — Ashulia", label: "Plant-02 — Ashulia" },
];
