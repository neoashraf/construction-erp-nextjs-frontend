"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable } from "./shared";
import { IpcAgeingBadge } from "./IpcAgeingBadge";
import { type IpcBillingRow, type IpcBillingTotals } from "../types";

/**
 * FE-57 IPC billing body — one row per IPC + a "Project cumulative" `<tfoot>`
 * rendered straight from `meta.totals` (SAL's numbers, never re-summed —
 * FR-RPT-016/-017/-004). Ageing badge is label + colour (WCAG 1.4.1).
 */
export function IpcBillingTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
  cumulativeLabel = "Project cumulative",
}: {
  rows: IpcBillingRow[] | undefined;
  totals: IpcBillingTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
  cumulativeLabel?: string;
}) {
  if (isLoading) return <LoadingBody testid="pi-ipc-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the IPC report."
        onRetry={onRetry}
        testid="pi-ipc-error"
        retryTestid="pi-ipc-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="pi-ipc-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="pi-ipc-empty" />;

  const captionId = "pi-ipc-caption";
  return (
    <div data-testid="pi-ipc-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">IPC No.</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">IPC date</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Due date</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Certified</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Billed</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Received</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Outstanding</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Retention held</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Ageing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ipcId}
                className="border-b border-border/60 hover:bg-canvas/60"
                data-testid="pi-ipc-row"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/sales/ipc/${r.ipcId}`}
                    className="font-mono text-[12.5px] text-accent-ink hover:underline"
                    aria-label={`Open IPC ${r.ipcNo}`}
                  >
                    {r.ipcNo}
                  </Link>
                  {r.projectName === null && r.projectId ? (
                    <div className="mt-0.5">
                      <NameUnavailable id={r.projectId} />
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatDdMmYyyy(r.ipcDate)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatDdMmYyyy(r.dueDate)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.certifiedAmount)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.billedAmount)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.receivedAmount)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatMoney(r.outstandingAmount)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(r.retentionHeldAmount)}
                </td>
                <td className="px-4 py-2.5">
                  <IpcAgeingBadge bucket={r.ageingBucket} />
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="pi-ipc-cumulative-footer"
              >
                <td className="px-4 py-3" colSpan={3}>{cumulativeLabel}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.certified)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.billed)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.received)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.outstanding)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.retentionHeld)}
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

function formatDdMmYyyy(iso: string): string {
  // Server ships YYYY-MM-DD; render as DD/MM/YYYY.
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
