"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, LoadingBody, NameUnavailable } from "./shared";
import { IpcAgeingBadge } from "./IpcAgeingBadge";
import {
  type IpcBillingRow,
  type IpcBillingTotals,
  type OutstandingProjectTotals,
} from "../types";

/**
 * FE-57 Outstanding body (FR-RPT-020, spec §5). Per-IPC rows grouped by
 * project with a per-project "Project outstanding" band + a report totals
 * `<tfoot>` — all figures rendered straight from `meta.totals` /
 * `meta.projectTotals` (reconciling to SAL; no client Σ).
 */
export function OutstandingTable({
  rows,
  totals,
  projectTotals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: IpcBillingRow[] | undefined;
  totals: IpcBillingTotals | null;
  projectTotals: OutstandingProjectTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="pi-out-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the outstanding report."
        onRetry={onRetry}
        testid="pi-out-error"
        retryTestid="pi-out-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="pi-out-idle" />;
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="pi-out-empty" />;

  const grouped = groupByProject(rows);
  const captionId = "pi-out-caption";
  return (
    <div data-testid="pi-out-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">IPC No.</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">IPC date</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Due date</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Certified</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Received</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Outstanding</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Ageing</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <ProjectGroup
                key={g.projectId}
                group={g}
                projectTotal={projectTotals?.[g.projectId] ?? null}
              />
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="pi-out-totals-footer"
              >
                <td className="px-4 py-3" colSpan={3}>
                  Report total
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.certified)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.received)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.outstanding)}
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

interface Group {
  projectId: string;
  projectName: string | null;
  rows: IpcBillingRow[];
}

function groupByProject(rows: IpcBillingRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const id = r.projectId ?? "__unknown__";
    let g = map.get(id);
    if (!g) {
      g = { projectId: id, projectName: r.projectName ?? null, rows: [] };
      map.set(id, g);
    }
    g.rows.push(r);
  }
  return Array.from(map.values());
}

function ProjectGroup({
  group,
  projectTotal,
}: {
  group: Group;
  projectTotal: IpcBillingTotals | null;
}) {
  return (
    <>
      <tr className="bg-canvas/70" data-testid="pi-out-project-band">
        <td colSpan={7} className="px-4 py-2 text-[12px] font-semibold text-foreground">
          {group.projectName ? (
            group.projectName
          ) : (
            <NameUnavailable id={group.projectId} />
          )}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr
          key={r.ipcId}
          className="border-b border-border/60 hover:bg-canvas/60"
          data-testid="pi-out-row"
        >
          <td className="px-4 py-2.5">
            <Link
              href={`/sales/ipc/${r.ipcId}`}
              className="font-mono text-[12.5px] text-accent-ink hover:underline"
              aria-label={`Open IPC ${r.ipcNo}`}
            >
              {r.ipcNo}
            </Link>
          </td>
          <td className="px-4 py-2.5 tabular-nums">{formatDdMmYyyy(r.ipcDate)}</td>
          <td className="px-4 py-2.5 tabular-nums">{formatDdMmYyyy(r.dueDate)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {formatMoney(r.certifiedAmount)}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {formatMoney(r.receivedAmount)}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
            {formatMoney(r.outstandingAmount)}
          </td>
          <td className="px-4 py-2.5">
            <IpcAgeingBadge bucket={r.ageingBucket} />
          </td>
        </tr>
      ))}
      {projectTotal && (
        <tr
          className="border-b border-border bg-warning-soft/50 text-[12.5px] font-bold"
          data-testid="pi-out-project-total"
        >
          <td colSpan={5} className="px-4 py-2 text-right">
            Project outstanding
          </td>
          <td className="px-4 py-2 text-right tabular-nums text-warning-ink">
            {formatMoney(projectTotal.outstanding)}
          </td>
          <td />
        </tr>
      )}
    </>
  );
}

function formatDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
