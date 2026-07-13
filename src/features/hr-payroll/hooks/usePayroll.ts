"use client";

import { useMemo } from "react";
import Decimal from "decimal.js";
import {
  PAYSLIPS_SEED,
  SALARY_LINES_SEED,
  SALARY_SHEETS_SEED,
  PAYROLL_PERIOD,
} from "../seed/payroll";
import { type Payslip, type SalarySheet, type SalarySheetLine } from "../types";

/**
 * Salary + payslip data access (FR-HR-013/014/017). Backed by the local seed for now;
 * the filter/aggregate shape mirrors `GET /api/salary/sheets(/:id)(/payslips)` so these
 * hooks can be repointed at the live endpoints without changing the screens.
 */

/** The salary-sheet register (FR-HR-013). */
export function useSalarySheets(): SalarySheet[] {
  return SALARY_SHEETS_SEED;
}

/** A single salary sheet by id, with its lines (FR-HR-013/014). */
export function useSalarySheet(id: string): {
  sheet: SalarySheet | undefined;
  lines: SalarySheetLine[];
} {
  return useMemo(() => {
    const sheet = SALARY_SHEETS_SEED.find((s) => s.id === id || s.periodLabel === id);
    // Only the posted June run has seeded lines; others reuse them for the mockup.
    const lines = sheet ? SALARY_LINES_SEED : [];
    return { sheet, lines };
  }, [id]);
}

export interface PayslipListItem {
  employeeCode: string;
  name: string;
  designation: string;
  paidDays: number;
  workingDays: number;
  grossAmount: string;
  netAmount: string;
}

/** Payslips for the posted June run, filtered by a code/name query (FR-HR-017). */
export function usePayslips(q: string): {
  items: PayslipListItem[];
  totalCount: number;
  shownNet: string;
  totalNet: string;
} {
  return useMemo(() => {
    const query = q.trim().toLowerCase();
    const all = PAYSLIPS_SEED;
    const filtered = query
      ? all.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.employeeCode.toLowerCase().includes(query),
        )
      : all;
    const sumNet = (rows: Payslip[]) =>
      rows.reduce((acc, p) => acc.plus(new Decimal(p.netAmount)), new Decimal(0)).toFixed(4);
    return {
      items: filtered.map((p) => ({
        employeeCode: p.employeeCode,
        name: p.name,
        designation: p.designation,
        paidDays: p.paidDays,
        workingDays: p.workingDays,
        grossAmount: p.grossAmount,
        netAmount: p.netAmount,
      })),
      totalCount: all.length,
      shownNet: sumNet(filtered),
      totalNet: sumNet(all),
    };
  }, [q]);
}

/** A single payslip by employee code (FR-HR-017). */
export function usePayslip(code: string): Payslip | undefined {
  return useMemo(() => PAYSLIPS_SEED.find((p) => p.employeeCode === code), [code]);
}

export { PAYROLL_PERIOD };
