"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, InactiveTag, LoadingBody, NameUnavailable } from "./shared";
import { type SalaryRegisterRow, type SalaryRegisterTotals } from "../types";

/**
 * FE-60 Salary register body (FR-RPT-027). Per-employee columns; register-
 * totals footer rendered straight from `meta.totals.gross / .net` (the
 * backend reconciles to the posted SALARY ledger entry — the FE asserts no
 * reconciliation of its own).
 */
export function SalaryRegisterTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: SalaryRegisterRow[] | undefined;
  totals: SalaryRegisterTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="hr-sr-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the salary register."
        onRetry={onRetry}
        testid="hr-sr-error"
        retryTestid="hr-sr-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="hr-sr-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="hr-sr-empty" />;

  const captionId = "hr-sr-caption";
  return (
    <div data-testid="hr-sr-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Employee</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Project</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Gross</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Allowances</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">TDS</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">PF</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Advance rec.</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Other</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.salaryRunId}-${r.employeeId}`}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="hr-sr-row"
              >
                <td className="px-4 py-2.5">
                  {r.employeeName ? (
                    <>
                      <span className="font-medium">{r.employeeName}</span>
                      {r.employeeInactive && <InactiveTag />}
                    </>
                  ) : (
                    <NameUnavailable id={r.employeeId} />
                  )}
                  {r.journalEntryNo && (
                    <div className="mt-0.5">
                      <Link
                        href={`/ledger/entries/${r.journalEntryId}`}
                        className="font-mono text-[11px] text-accent-ink hover:underline"
                        aria-label={`Open salary journal ${r.journalEntryNo}`}
                      >
                        {r.journalEntryNo}
                      </Link>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {r.projectName ?? <NameUnavailable id={r.projectId ?? "—"} />}
                </td>
                <td className="px-4 py-2.5">
                  {r.costCentreName ? (
                    <span className="font-medium">
                      {r.costCentreCode}
                      <span className="mx-1 text-muted-foreground">·</span>
                      {r.costCentreName}
                    </span>
                  ) : (
                    <NameUnavailable id={r.costCentreCode ?? r.costCentreId ?? "—"} />
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.grossPay)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.allowances)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.tds)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.pf)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.advanceRecovery)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.otherDeductions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatMoney(r.netPay)}
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="hr-sr-totals-footer"
              >
                <td colSpan={3} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums" colSpan={6}>
                  Gross {formatMoney(totals.gross)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.net)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}
