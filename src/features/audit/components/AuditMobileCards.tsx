"use client";

import { formatDateTime } from "@/lib/format";
import { ActionBadge } from "./ActionBadge";
import { type AuditLogRow } from "../types";

/**
 * Mobile (>=360) read-only stacked summary cards (screen spec §4). Desktop/tablet
 * (this is a dense, forensic back-office screen) — mobile shows only Timestamp,
 * Actor, Action, Entity; the side-by-side diff and export are noted as best on a
 * larger screen (spec §4/§9), not reproduced here.
 */
export function AuditMobileCards({
  rows,
  onOpen,
}: {
  rows: AuditLogRow[];
  onOpen: (row: AuditLogRow) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 md:hidden" data-testid="audit-mobile-cards">
      <p
        className="rounded-token bg-info-soft px-3 py-2 text-[11.5px] text-info-ink"
        data-testid="audit-mobile-note"
      >
        The side-by-side before/after diff and export are best on a larger screen.
      </p>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onOpen(row)}
          className="block w-full rounded-card border border-border bg-surface p-3.5 text-left shadow-sm hover:bg-accent-soft/60"
          data-testid={`audit-card-${row.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </span>
            <ActionBadge action={row.action} />
          </div>
          <div className="mt-2 text-[13px] font-medium text-foreground">
            {row.userName || row.userId}
          </div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            {row.entityType} <span className="text-faint">·</span>{" "}
            <span className="font-mono text-[11.5px]">{row.entityId}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
