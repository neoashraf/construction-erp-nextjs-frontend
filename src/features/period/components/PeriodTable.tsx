"use client";

import { Lock, RotateCcw } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { type AccountingPeriod } from "../types";

/**
 * The period table (spec §5/§6): Period · Date range · Status · Closed at ·
 * Closed by · Action; ordered by `startDate` asc (the caller passes already-
 * sorted rows — the API orders server-side). Close/Reopen are mutually
 * exclusive per row by status (spec §9) and gated by the caller's capability
 * flags. A real `<table>` with `<th scope="col">` (spec §10 a11y).
 */
export function PeriodTable({
  periods,
  canClose,
  canReopen,
  actingId,
  onClose,
  onReopen,
}: {
  periods: AccountingPeriod[];
  canClose: boolean;
  canReopen: boolean;
  /** The id of the row with an in-flight close/reopen (spec §6 saving state). */
  actingId: string | null;
  onClose: (period: AccountingPeriod) => void;
  onReopen: (period: AccountingPeriod) => void;
}) {
  const showActionColumn = canClose || canReopen;

  return (
    <Table data-testid="period-table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Period</TableHead>
          <TableHead scope="col">Date range</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Closed at</TableHead>
          <TableHead scope="col">Closed by</TableHead>
          {showActionColumn && (
            <TableHead scope="col" className="text-right">
              Action
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {periods.map((period) => {
          const isOpen = period.status === "OPEN";
          const isActing = actingId === period.id;
          return (
            <TableRow key={period.id} data-testid={`period-row-${period.id}`}>
              <TableCell className="font-semibold text-accent-ink">{period.name}</TableCell>
              <TableCell className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {formatDate(period.startDate)} – {formatDate(period.endDate)}
              </TableCell>
              <TableCell>
                {isOpen ? (
                  <Badge tone="success" dot>
                    Open
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    <Lock className="h-3 w-3" aria-hidden />
                    Closed
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {period.closedAt ? formatDateTime(period.closedAt) : "—"}
              </TableCell>
              <TableCell
                className="min-w-0 break-words text-foreground"
                title={period.closedBy ?? undefined}
              >
                {period.closedByName ?? period.closedBy ?? "—"}
              </TableCell>
              {showActionColumn && (
                <TableCell className="text-right">
                  {isOpen && canClose && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onClose(period)}
                      disabled={isActing}
                      aria-busy={isActing || undefined}
                      data-testid={`close-${period.id}`}
                    >
                      {isActing ? "Closing…" : "Close"}
                    </Button>
                  )}
                  {!isOpen && canReopen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReopen(period)}
                      disabled={isActing}
                      aria-busy={isActing || undefined}
                      className="border-info/40 text-info-ink"
                      data-testid={`reopen-${period.id}`}
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      {isActing ? "Reopening…" : "Reopen"}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
