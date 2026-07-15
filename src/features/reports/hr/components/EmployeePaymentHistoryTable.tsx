"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable, ddMmYyyy } from "./shared";
import { type EmployeePaymentRow, type EmployeePaymentTotals } from "../types";

/**
 * FE-60 Employee payment history body (FR-RPT-028). Per-employee payment
 * settlements over a date range; `payableRef` links to the source payment
 * voucher (cross-ref, not rebuilt).
 */
export function EmployeePaymentHistoryTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: EmployeePaymentRow[] | undefined;
  totals: EmployeePaymentTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="hr-ph-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load employee payment history."
        onRetry={onRetry}
        testid="hr-ph-error"
        retryTestid="hr-ph-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="hr-ph-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="hr-ph-empty" />;

  const captionId = "hr-ph-caption";
  return (
    <div data-testid="hr-ph-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Employee</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Payment date</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Paid amount</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Payable ref.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.paymentId}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="hr-ph-row"
              >
                <td className="px-4 py-2.5">
                  {r.employeeName ?? <NameUnavailable id={r.employeeId} />}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{ddMmYyyy(r.paymentDate)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatMoney(r.paidAmount)}
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/payments/${r.paymentVoucherId}`}
                    className="font-mono text-[12.5px] text-accent-ink hover:underline"
                    aria-label={`Open payment voucher ${r.payableRef}`}
                  >
                    {r.payableRef}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="hr-ph-totals-footer"
              >
                <td className="px-4 py-3">Range totals</td>
                <td className="px-4 py-3 tabular-nums">
                  {totals.paidCount} settlements
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.totalPaid)}
                </td>
                <td className="px-4 py-3" />
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
