"use client";

import { formatMoney } from "@/lib/money";
import { useMasterLookups } from "@/lib/masters/lookups";
import { SalaryLineRow } from "./SalaryLineRow";
import { type SalaryLineUpdateInput, type SalarySheetLine } from "../api/salary";

/**
 * The per-employee lines table (spec §4/§5). ≥lg → full grid (Employee · Project · Cost
 * centre · Purpose · Paid days · Gross · Allowances · TDS · PF · Advance · Other · Net).
 * <lg → stacked read-only cards per employee (spec §4 tablet/360 degrade). Cost centre is
 * always the Labour cost centre; a line missing project/cost-centre/purpose surfaces the
 * inline "Missing dimension" pill so `MISSING_REQUIRED_DIMENSION` never surprises a Post.
 */
export function SalaryLinesTable({
  lines,
  readOnly,
  savingLineId,
  onPatch,
  lineErrors,
  purposeLookup,
}: {
  lines: SalarySheetLine[];
  readOnly: boolean;
  savingLineId?: string | null;
  onPatch: (lineId: string, input: SalaryLineUpdateInput) => void;
  lineErrors: Record<string, string>;
  purposeLookup: (id: string | null | undefined) => string;
}) {
  const lookups = useMasterLookups();

  return (
    <div data-testid="salary-lines-table" aria-readonly={readOnly || undefined}>
      {/* ≥lg full grid */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full" style={{ minWidth: 1080 }}>
          <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
            <tr>
              <th className="h-11 px-4 text-left">Employee</th>
              <th className="h-11 px-2.5 text-left">Project</th>
              <th className="h-11 px-2.5 text-left">Cost ctr</th>
              <th className="h-11 px-2 text-right">Paid d</th>
              <th className="h-11 px-2.5 text-right">Gross ৳</th>
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
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* <lg stacked read-only cards (spec §4 360 degrade) */}
      <div className="flex flex-col lg:hidden" data-testid="salary-lines-mobile">
        {lines.map((line) => (
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
        ))}
      </div>
    </div>
  );
}

/** Return the resolved name, or `{id.slice(0,8)} (name unavailable)` when the lookup misses (spec §6 partial). */
function resolveOrRaw(id: string | null, resolver: (id: string | null | undefined) => string): string {
  if (!id) return "";
  const val = resolver(id);
  if (val === id) return `${id.slice(0, 8)} (name unavailable)`;
  return val;
}
