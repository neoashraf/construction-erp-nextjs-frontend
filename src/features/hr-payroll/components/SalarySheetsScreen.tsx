"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { useSalaryRuns, type SalarySheetFilter } from "../hooks/useSalarySheets";
import { type SalarySheetStatus } from "../types";
import { displayMoneyBare } from "../lib";
import { SalaryStatusBadge } from "./SalaryStatusBadge";
import { GenerateSheetDialog } from "./SalaryDialogs";

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Salary-sheet runs list (FR-HR-013; Salary Sheet.dc.html landing). One balanced
 * SALARY journal per posted period; a run opens into the editor/viewer. Generate is
 * permission-driven (`hr.salary_sheets:CREATE`); backed by the local seed.
 */
export function SalarySheetsScreen() {
  const session = useSession();
  const canManage = session ? hasGrant(session, "hr.salary_sheets", "CREATE") : false;

  const [status, setStatus] = useState<SalarySheetStatus | "ALL">("ALL");
  const [generating, setGenerating] = useState(false);

  const filter: SalarySheetFilter = { status, q: "" };
  const { runs, draftCount, total } = useSalaryRuns(filter);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Salary sheet</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Payroll runs on the general ledger — one balanced SALARY journal per posted period.
          </p>
        </div>
        {canManage && (
          <Button className="h-[38px] flex-none px-4" onClick={() => setGenerating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Generate for period
          </Button>
        )}
      </div>

      {/* filter bar */}
      <Card className="mt-4 p-3.5 sm:px-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-none flex-col gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Financial year
            </span>
            <Select aria-label="Financial year" className="h-9 w-[180px]" defaultValue="2025-26">
              <option value="2025-26">FY 2025–26</option>
            </Select>
          </div>
          <div className="flex flex-none flex-col gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Status
            </span>
            <Select
              aria-label="Filter by status"
              className="h-9 w-[160px]"
              value={status}
              onChange={(e) => setStatus(e.target.value as SalarySheetStatus | "ALL")}
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
            </Select>
          </div>
          <span className="ml-auto inline-flex h-9 items-center rounded-pill bg-muted px-3 text-[11.5px] font-semibold text-muted-foreground">
            {total} runs · {draftCount} draft
          </span>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-3 sm:p-4">
        {runs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No salary runs yet."
            description="Generate your first salary sheet for a payroll period."
            action={
              canManage ? (
                <Button onClick={() => setGenerating(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Generate for period
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Period</TableHead>
                <TableHead className="hidden md:table-cell">Period start – end</TableHead>
                <TableHead className="text-right">Total gross ৳</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Total deductions ৳</TableHead>
                <TableHead className="text-right">Total net ৳</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/hr/salary-sheets/${r.id}`}
                      className="font-mono text-[12.5px] font-semibold text-accent-ink hover:underline"
                    >
                      {r.periodLabel}
                    </Link>
                    <div className="font-mono text-[11px] text-faint">
                      {r.salaryEntryNo ?? "Not yet posted"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-[12.5px] tabular-nums text-muted-foreground md:table-cell">
                    {safeDate(r.periodStart)} – {safeDate(r.periodEnd)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px] tabular-nums text-foreground">
                    {displayMoneyBare(r.totalGross)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-[13px] tabular-nums text-destructive-ink sm:table-cell">
                    − {displayMoneyBare(r.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                    {displayMoneyBare(r.totalNet)}
                  </TableCell>
                  <TableCell>
                    <SalaryStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {runs.length > 0 && (
          <div className="mt-3 border-t border-border px-1 pt-3 text-[12.5px] text-muted-foreground">
            Showing <span className="font-semibold text-foreground">1–{runs.length}</span> of{" "}
            <span className="font-semibold text-foreground">{total}</span> runs
          </div>
        )}
      </Card>

      <GenerateSheetDialog open={generating} onClose={() => setGenerating(false)} />
    </div>
  );
}
