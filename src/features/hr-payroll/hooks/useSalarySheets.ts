"use client";

import { useMemo } from "react";
import {
  SALARY_RUNS_SEED,
  DRAFT_LINES_SEED,
  REVERSED_BY,
  type DraftLine,
} from "../seed/salary-sheet";
import { type SalarySheet, type SalarySheetStatus } from "../types";

/**
 * Salary-sheet register + editor data (FR-HR-013/014/015). Backed by the local seed;
 * the filter shape mirrors `GET /api/salary/sheets(/:id)` so the screens can repoint at
 * the live endpoints unchanged. Only the 2026-06 DRAFT run carries editable lines.
 */

export interface SalarySheetFilter {
  status: SalarySheetStatus | "ALL";
  q: string;
}

/** Filtered register (FR-HR-013). */
export function useSalaryRuns(filter: SalarySheetFilter): {
  runs: SalarySheet[];
  draftCount: number;
  total: number;
} {
  return useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    const runs = SALARY_RUNS_SEED.filter((r) => {
      if (filter.status !== "ALL" && r.status !== filter.status) return false;
      if (q && !r.periodLabel.toLowerCase().includes(q)) return false;
      return true;
    });
    return {
      runs,
      draftCount: SALARY_RUNS_SEED.filter((r) => r.status === "DRAFT").length,
      total: SALARY_RUNS_SEED.length,
    };
  }, [filter]);
}

/** A single run + its lines + any reversal reference (FR-HR-014). */
export function useSalaryRun(id: string): {
  run: SalarySheet | undefined;
  lines: DraftLine[];
  reversedBy: string | null;
} {
  return useMemo(() => {
    const run = SALARY_RUNS_SEED.find((r) => r.id === id || r.periodLabel === id);
    // Only the DRAFT run seeds real editable lines; others reuse them for the mockup.
    const lines = run ? DRAFT_LINES_SEED : [];
    return {
      run,
      lines,
      reversedBy: run ? (REVERSED_BY[run.periodLabel] ?? null) : null,
    };
  }, [id]);
}
