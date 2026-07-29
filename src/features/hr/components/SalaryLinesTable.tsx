"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useMasterLookups } from "@/lib/masters/lookups";
import { SalaryLineRow, formatDays, isDailyLine } from "./SalaryLineRow";
import { type SalaryLineUpdateInput, type SalarySheetLine } from "../api/salary";
import { DAYS_GROUP_HELPER, formatLateCell, lateColumnHelper } from "../schemas/salary.schema";

/**
 * The per-employee lines table (spec §4/§5; FR-HR-013a).
 *
 * ≥lg → full grid with the FR-HR-013a **Days** column group — Standard · Unpaid · Paid ·
 * Late under one "Days" band (`scope="colgroup"`), so the corrected `paid = standard −
 * unpaid` figure and the late penalty are checkable in place. md..lg → condensed table
 * (Employee · Paid d · Gross · Deduct · Net) with Standard/Unpaid/Late + the dimension
 * tags behind a per-line expander — Paid d stays first-class, it is the figure gross is
 * computed from. <md → read-only stacked cards with the paid/unpaid sub-line.
 *
 * Cost centre is always the Labour cost centre; a line missing project/cost-centre/purpose
 * surfaces the inline "Missing dimension" pill so `MISSING_REQUIRED_DIMENSION` never
 * surprises a Post.
 */
export function SalaryLinesTable({
  lines,
  readOnly,
  savingLineId,
  onPatch,
  lineErrors,
  purposeLookup,
  latesPerDeductedDay,
}: {
  lines: SalarySheetLine[];
  readOnly: boolean;
  savingLineId?: string | null;
  onPatch: (lineId: string, input: SalaryLineUpdateInput) => void;
  lineErrors: Record<string, string>;
  purposeLookup: (id: string | null | undefined) => string;
  /** Company divisor for the Late column tooltip (FR-HR-008c) — undefined until loaded. */
  latesPerDeductedDay?: number;
}) {
  const lookups = useMasterLookups();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lateHelp = latesPerDeductedDay != null ? lateColumnHelper(latesPerDeductedDay) : undefined;

  return (
    <div data-testid="salary-lines-table" aria-readonly={readOnly || undefined}>
      {/* ≥lg full grid with the Days group */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full" style={{ minWidth: 1240 }}>
          <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
            <tr>
              <th colSpan={3} aria-hidden className="h-7" />
              <th
                colSpan={4}
                scope="colgroup"
                className="h-7 border-b border-border px-2 text-center"
                data-testid="days-group-header"
              >
                <span className="inline-flex items-center gap-1">
                  Days
                  <span title={DAYS_GROUP_HELPER} data-testid="days-group-helper">
                    <Info className="h-3 w-3 text-faint" aria-hidden />
                    <span className="sr-only">{DAYS_GROUP_HELPER}</span>
                  </span>
                </span>
              </th>
              <th colSpan={8} aria-hidden className="h-7" />
            </tr>
            <tr>
              <th className="h-11 px-4 text-left">Employee</th>
              <th className="h-11 px-2.5 text-left">Project</th>
              <th className="h-11 px-2.5 text-left">Cost ctr</th>
              <th className="h-11 px-2 text-right">Standard</th>
              <th className="h-11 px-2 text-right">Unpaid</th>
              <th className="h-11 px-2 text-right">Paid</th>
              <th className="h-11 px-2 text-right" title={lateHelp} data-testid="late-column-header">
                Late
              </th>
              <th
                className="h-11 px-2.5 text-right"
                title="Gross is already net of the late penalty — the penalty is not a separate deduction."
              >
                Gross ৳
              </th>
              <th className="h-11 px-2.5 text-right">Allow. ৳</th>
              <th className="h-11 px-2 text-right">TDS ৳</th>
              <th className="h-11 px-2 text-right">PF ৳</th>
              <th className="h-11 px-2.5 text-right">Adv. ৳</th>
              <th className="h-11 px-2.5 text-right">Other ৳</th>
              <th className="h-11 px-4 text-right">Net ৳</th>
              <th className="h-11 px-3" />
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {lines.map((line) => (
              <SalaryLineRow
                key={line.id}
                line={line}
                readOnly={readOnly}
                saving={savingLineId === line.id}
                onPatch={onPatch}
                projectLabel={resolveOrRaw(line.projectId, lookups.project)}
                costCentreLabel={resolveOrRaw(line.costCentreId, lookups.costCentre)}
                purposeLabel={resolveOrRaw(line.purposeId, purposeLookup)}
                rowError={lineErrors[line.id]}
                latesPerDeductedDay={latesPerDeductedDay}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* md..lg condensed table — Standard/Unpaid/Late + tags behind the per-line expander */}
      <div className="hidden md:block lg:hidden" data-testid="salary-lines-tablet">
        <table className="w-full">
          <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
            <tr>
              <th className="h-11 w-8 px-2" aria-hidden />
              <th className="h-11 px-3 text-left">Employee</th>
              <th className="h-11 px-2 text-right">Paid d</th>
              <th className="h-11 px-2.5 text-right">Gross ৳</th>
              <th className="h-11 px-2.5 text-right">Deduct ৳</th>
              <th className="h-11 px-3 text-right">Net ৳</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {lines.map((line) => {
              const daily = isDailyLine(line);
              const deduct =
                Number(line.tdsAmount) +
                Number(line.pfAmount) +
                Number(line.advanceRecovery) +
                Number(line.otherDeductions);
              const expanded = expandedId === line.id;
              return (
                <SalaryTabletRow
                  key={line.id}
                  line={line}
                  daily={daily}
                  deduct={deduct}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : line.id)}
                  projectLabel={resolveOrRaw(line.projectId, lookups.project)}
                  costCentreLabel={resolveOrRaw(line.costCentreId, lookups.costCentre)}
                  lateHelp={lateHelp}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* <md stacked read-only cards (spec §4 360 degrade) */}
      <div className="flex flex-col md:hidden" data-testid="salary-lines-mobile">
        {lines.map((line) => {
          const unpaid = Number(line.unpaidDays);
          const daily = isDailyLine(line);
          return (
            <div
              key={line.id}
              className="border-b border-muted px-3 py-3"
              data-testid={`salary-line-card-${line.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {line.employeeName}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">{line.employeeCode}</div>
                </div>
                <div className="text-right font-mono tabular-nums text-[13px] font-bold text-foreground">
                  ৳ {formatMoney(line.netAmount, { withSymbol: false })}
                </div>
              </div>
              {/* FR-HR-013a sub-line — the unpaid segment is emphasised, never colour alone. */}
              <div className="mt-1 text-[11.5px] text-muted-foreground" data-testid={`card-days-${line.id}`}>
                {formatDays(line.paidDays)} paid d
                {!daily && (
                  <>
                    {" · "}
                    <span className={cn(unpaid > 0 && "font-bold text-destructive-ink")}>
                      {formatDays(line.unpaidDays)} unpaid
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <div className="text-faint">Gross</div>
                  <div className="font-mono tabular-nums">{formatMoney(line.grossAmount, { withSymbol: false })}</div>
                </div>
                <div>
                  <div className="text-faint">Deductions</div>
                  <div className="font-mono tabular-nums">
                    {formatMoney(
                      String(
                        Number(line.tdsAmount) +
                          Number(line.pfAmount) +
                          Number(line.advanceRecovery) +
                          Number(line.otherDeductions),
                      ),
                      { withSymbol: false },
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One condensed row + its expander row (tablet ≥768; spec §4). */
function SalaryTabletRow({
  line,
  daily,
  deduct,
  expanded,
  onToggle,
  projectLabel,
  costCentreLabel,
  lateHelp,
}: {
  line: SalarySheetLine;
  daily: boolean;
  deduct: number;
  expanded: boolean;
  onToggle: () => void;
  projectLabel: string;
  costCentreLabel: string;
  lateHelp?: string;
}) {
  return (
    <>
      <tr className="h-[52px] border-b border-muted">
        <td className="px-2 py-2.5 align-middle">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${line.employeeName}`}
            onClick={onToggle}
            className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        </td>
        <td className="px-3 py-2.5 align-middle">
          <div className="text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
            {line.employeeName}
          </div>
          <div className="font-mono text-[10.5px] text-faint">{line.employeeCode}</div>
        </td>
        <td className="px-2 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums">
          {formatDays(line.paidDays)}
        </td>
        <td className="px-2.5 py-2.5 text-right font-mono text-[12.5px] tabular-nums">
          {formatMoney(line.grossAmount, { withSymbol: false })}
        </td>
        <td className="px-2.5 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-destructive">
          − {formatMoney(String(deduct), { withSymbol: false })}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums">
          {formatMoney(line.netAmount, { withSymbol: false })}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-muted bg-muted/40">
          <td colSpan={6} className="px-4 py-2.5 text-[12px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex h-[21px] items-center rounded-token bg-accent-soft px-2 text-[10.5px] font-semibold text-accent-ink">
                {projectLabel}
              </span>
              <span className="inline-flex h-[21px] items-center rounded-token bg-accent-soft px-2 text-[10.5px] font-semibold text-accent-ink">
                {costCentreLabel}
              </span>
              <span>
                Standard <strong className="font-mono tabular-nums">{daily ? "—" : formatDays(line.standardDays)}</strong>
              </span>
              <span>
                Unpaid{" "}
                <strong
                  className={cn(
                    "font-mono tabular-nums",
                    !daily && Number(line.unpaidDays) > 0 && "text-destructive-ink",
                  )}
                >
                  {daily ? "—" : formatDays(line.unpaidDays)}
                </strong>
              </span>
              <span title={lateHelp}>
                Late{" "}
                <strong className="font-mono tabular-nums">
                  {daily ? "—" : formatLateCell(line.lateCount, line.latePenaltyDays)}
                </strong>
              </span>
              {!daily && Number(line.latePenaltyAmount) > 0 ? (
                <span>
                  Penalty{" "}
                  <strong className="font-mono tabular-nums">
                    ৳ {formatMoney(line.latePenaltyAmount, { withSymbol: false })}
                  </strong>
                </span>
              ) : null}
              {daily ? (
                <span className="rounded-pill bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase text-muted-foreground">
                  Daily wage
                </span>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Return the resolved name, or `{id.slice(0,8)} (name unavailable)` when the lookup misses (spec §6 partial). */
function resolveOrRaw(id: string | null, resolver: (id: string | null | undefined) => string): string {
  if (!id) return "";
  const val = resolver(id);
  if (val === id) return `${id.slice(0, 8)} (name unavailable)`;
  return val;
}
