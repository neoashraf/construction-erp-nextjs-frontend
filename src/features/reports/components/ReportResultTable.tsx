"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ReportGeneratedAt } from "./ReportGeneratedAt";

/**
 * FE-54 generic result table shell. Viewers pass `columns[]` and rows; the
 * shell handles the state matrix (loading skeleton · empty · partial · error +
 * retry) + the "Generated at" caption + a totals footer slot.
 */
export interface ReportColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Money columns use tabular-nums right-aligned by convention. */
  numeric?: boolean;
  className?: string;
}

export interface ReportResultTableProps<Row> {
  columns: ReportColumn<Row>[];
  rows: Row[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel?: string;
  generatedAt?: string;
  totalsFooter?: React.ReactNode;
  /** Extra id for aria-describedby wiring. */
  captionId?: string;
}

export function ReportResultTable<Row>({
  columns,
  rows,
  isLoading,
  isError,
  onRetry,
  emptyLabel = "No results for these filters.",
  generatedAt,
  totalsFooter,
  captionId,
}: ReportResultTableProps<Row>) {
  if (isLoading) {
    return (
      <div className="p-6" data-testid="report-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-8" data-testid="report-error">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't run this report."
          description="Your parameters are preserved — try Run again."
          action={
            <Button size="md" onClick={onRetry} data-testid="report-retry">
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="p-8" data-testid="report-idle">
        <EmptyState
          icon={Inbox}
          title="Set parameters and select Run."
        />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div data-testid="report-empty">
        <div className="p-8">
          <EmptyState icon={Inbox} title={emptyLabel} />
        </div>
        {totalsFooter && (
          <div className="border-t border-border" data-testid="report-totals-footer">
            {totalsFooter}
          </div>
        )}
        {generatedAt && <div className="px-6 pb-4"><ReportGeneratedAt generatedAt={generatedAt} id={captionId} /></div>}
      </div>
    );
  }
  return (
    <div data-testid="report-result">
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-[13px]"
          aria-describedby={captionId}
          data-testid="report-table"
        >
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-11 px-4 text-left font-semibold",
                    (c.align === "right" || c.numeric) && "text-right tabular-nums",
                    c.align === "center" && "text-center",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-canvas/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5",
                      (c.align === "right" || c.numeric) && "text-right tabular-nums",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalsFooter && (
        <div className="border-t border-border" data-testid="report-totals-footer">
          {totalsFooter}
        </div>
      )}
      {generatedAt && (
        <div className="px-6 pb-4">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}

/** Placeholder for "name unavailable" (partial state) rows — spec §6/§13. */
export function NameUnavailable({ id }: { id: string }) {
  return (
    <span className="text-muted-foreground" data-testid="name-unavailable">
      {id}
      <span className="ml-1 text-[10.5px] italic">(name unavailable)</span>
    </span>
  );
}
