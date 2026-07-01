"use client";

import { MoreHorizontal, Pencil, Scale, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ContinuityBadge } from "./ContinuityBadge";
import { type NumberingSeries, voucherTypeLabel } from "../types";

/**
 * Series list — desktop grid (≥1024/≥768) + mobile stacked cards (≥360, read-only).
 * Columns (design file §5): Voucher type (label + enum code) · Prefix chip · Padding
 * width · Last sequence (right-aligned, faint when 0) · Next number sample (mono,
 * full-length, "grown past N digits" note when the sequence exceeds the width — never
 * clipped, FR-NUM-013/SRS §11 EC8) · Continuity badge · row actions. Non-Admins pass
 * `canManage=false` → no kebab (the screen also 403s them entirely).
 */

const GRID = "grid-cols-[1.75fr_0.8fr_1fr_0.95fr_1.4fr_1.15fr_52px]";

export function SeriesTable({
  series,
  canManage,
  onEdit,
  onAudit,
  onCopyNext,
}: {
  series: NumberingSeries[];
  canManage: boolean;
  onEdit: (s: NumberingSeries) => void;
  onAudit: (s: NumberingSeries) => void;
  onCopyNext: (s: NumberingSeries) => void;
}) {
  return (
    <>
      {/* Desktop / tablet grid */}
      <div
        role="table"
        aria-label="Numbering series"
        className="hidden md:block"
        data-testid="series-desktop"
      >
        <div
          role="row"
          className={cn(
            "sticky top-0 z-[2] grid border-b border-border-strong bg-surface-2",
            GRID,
          )}
        >
          <HeaderCell>Voucher type</HeaderCell>
          <HeaderCell>Prefix</HeaderCell>
          <HeaderCell>Padding width</HeaderCell>
          <HeaderCell align="right">Last sequence</HeaderCell>
          <HeaderCell>Next number (sample)</HeaderCell>
          <HeaderCell>Continuity</HeaderCell>
          <div role="columnheader" className="h-11" />
        </div>

        {series.map((s) => {
          const nextSeq = s.lastSequence + 1;
          const padExceeded = String(nextSeq).length > s.paddingWidth;
          return (
            <div
              key={s.id}
              role="row"
              tabIndex={0}
              className={cn(
                "grid items-center border-b border-border outline-none",
                "focus:bg-accent-soft hover:bg-surface-2",
                GRID,
              )}
              data-testid={`series-row-${s.voucherType}`}
            >
              {/* voucher type */}
              <div className="min-w-0 px-4 py-2.5">
                <div className="text-sm font-semibold text-accent-ink">
                  {voucherTypeLabel(s.voucherType)}
                </div>
                <div className="break-all font-mono text-[11px] text-faint">{s.voucherType}</div>
              </div>
              {/* prefix */}
              <div className="px-4 py-2.5">
                <span className="inline-flex h-6 items-center rounded-sm bg-muted px-2 font-mono text-[12.5px] font-semibold text-foreground">
                  {s.prefix}
                </span>
              </div>
              {/* padding width */}
              <div className="px-4 py-2.5 font-mono text-[13px] tabular-nums text-foreground">
                {s.paddingWidth} <span className="text-[11.5px] text-faint">digits</span>
              </div>
              {/* last sequence */}
              <div className="px-4 py-2.5 text-right">
                <span
                  className={cn(
                    "font-mono text-[13.5px] font-medium tabular-nums",
                    s.lastSequence === 0 ? "text-faint" : "text-foreground",
                  )}
                >
                  {s.lastSequence.toLocaleString("en-IN")}
                </span>
              </div>
              {/* next number sample — full length, never clipped */}
              <div className="min-w-0 px-4 py-2.5">
                <span
                  className="break-all font-mono text-[13px] font-semibold tabular-nums text-accent-ink"
                  title="Informational preview — the real posted number may differ if another post commits first."
                  data-testid={`series-next-${s.voucherType}`}
                >
                  {s.nextNumberPreview}
                </span>
                {padExceeded && (
                  <span className="mt-0.5 block text-[10.5px] text-warning-ink">
                    grown past {s.paddingWidth} digits
                  </span>
                )}
              </div>
              {/* continuity */}
              <div className="px-4 py-2.5">
                <ContinuityBadge seriesId={s.id} />
              </div>
              {/* actions */}
              <div className="flex items-center justify-center px-2 py-2.5">
                {canManage && (
                  <RowMenu
                    series={s}
                    onEdit={onEdit}
                    onAudit={onAudit}
                    onCopyNext={onCopyNext}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile read-only cards (≥360) — editing is a desktop task (spec §4) */}
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="series-mobile">
        {series.map((s) => (
          <div key={s.id} className="rounded-card border border-border bg-surface p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-start gap-2">
              <div className="min-w-0">
                <div className="text-[14.5px] font-bold text-foreground">
                  {voucherTypeLabel(s.voucherType)}
                </div>
                <div className="break-all font-mono text-[10.5px] text-faint">{s.voucherType}</div>
              </div>
              <span className="ml-auto flex-none">
                <ContinuityBadge seriesId={s.id} />
              </span>
            </div>
            <dl className="flex flex-col gap-2 border-t border-muted pt-2.5">
              <MobileRow label="Prefix" value={s.prefix} mono />
              <MobileRow label="Padding" value={`${s.paddingWidth} digits`} mono />
              <MobileRow
                label="Last sequence"
                value={s.lastSequence.toLocaleString("en-IN")}
                mono
              />
              <MobileRow label="Next number" value={s.nextNumberPreview} mono accent />
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

function HeaderCell({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <div
      role="columnheader"
      className={cn(
        "flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "justify-end",
      )}
    >
      {children}
    </div>
  );
}

function RowMenu({
  series,
  onEdit,
  onAudit,
  onCopyNext,
}: {
  series: NumberingSeries;
  onEdit: (s: NumberingSeries) => void;
  onAudit: (s: NumberingSeries) => void;
  onCopyNext: (s: NumberingSeries) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${voucherTypeLabel(series.voucherType)}`}
        className="grid h-[30px] w-[30px] place-items-center rounded-token border border-transparent text-muted-foreground hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`series-actions-${series.voucherType}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onSelect={() => onEdit(series)}
          data-testid={`series-edit-${series.voucherType}`}
        >
          <Pencil className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onAudit(series)}
          data-testid={`series-audit-${series.voucherType}`}
        >
          <Scale className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
          Run gap audit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopyNext(series)}>
          <Copy className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
          Copy next number
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn(
          "break-all text-right text-[12.5px]",
          mono && "font-mono tabular-nums",
          accent ? "font-semibold text-accent-ink" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
