"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type SalarySheetLine, type SalaryLineUpdateInput } from "../api/salary";

/** Lime dimension chip (Salary Sheet.dc.html lines grid — Project/Cost-centre tags). */
function DimensionChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[21px] max-w-full items-center truncate rounded-token bg-accent-soft px-2 text-[10.5px] font-semibold text-accent-ink">
      {children}
    </span>
  );
}

/**
 * One line on the desktop grid (spec §5). DRAFT: allowances/TDS/PF/advance/other are
 * editable inputs (blur → server PATCH). POSTED/REVERSED: every editable cell renders
 * as static text (`aria-readonly` on the table). Money always formatted via `formatMoney`
 * (Bangladeshi grouping, 4dp), right-aligned + monospace tabular-nums.
 */
export function SalaryLineRow({
  line,
  readOnly,
  saving,
  onPatch,
  projectLabel,
  costCentreLabel,
  purposeLabel,
  rowError,
}: {
  line: SalarySheetLine;
  readOnly: boolean;
  saving: boolean;
  onPatch: (lineId: string, input: SalaryLineUpdateInput) => void;
  projectLabel: string;
  costCentreLabel: string;
  purposeLabel: string;
  rowError?: string;
}) {
  const missingDim = !line.projectId || !line.costCentreId || !line.purposeId;
  // Purpose is intentionally not a visible column (Salary Sheet.dc.html shows Employee →
  // Project → Cost centre → Paid days, no Purpose track) — the value still gates Post via
  // `missingDim` and the "Missing dimension" pill below.
  void purposeLabel;
  return (
    <tr
      className={cn("h-[52px] border-b border-muted", saving && "opacity-70")}
      data-testid={`salary-line-${line.id}`}
      data-line-status={readOnly ? "readonly" : "editable"}
    >
      <td className="px-4 py-2.5 align-middle">
        <Link
          href={`/hr/employees/${line.employeeId}`}
          className="block text-[13px] font-semibold text-accent-ink underline-offset-2 [overflow-wrap:anywhere] hover:underline"
        >
          {line.employeeName}
        </Link>
        <div className="font-mono text-[10.5px] text-faint">{line.employeeCode}</div>
      </td>
      <td className="px-2.5 py-2.5 align-middle">
        <DimensionChip>{projectLabel}</DimensionChip>
      </td>
      <td className="px-2.5 py-2.5 align-middle">
        <DimensionChip>{costCentreLabel}</DimensionChip>
      </td>
      <td className="px-2 py-2.5 align-middle text-right font-mono tabular-nums text-[12.5px] text-muted-foreground">{line.paidDays}</td>
      <td className="px-2.5 py-2.5 align-middle text-right font-mono tabular-nums text-[12.5px] text-foreground" data-testid={`line-gross-${line.id}`}>
        {formatMoney(line.grossAmount, { withSymbol: false })}
      </td>
      <MoneyCell value={line.allowances} readOnly={readOnly} testId={`line-allow-${line.id}`} onCommit={(v) => onPatch(line.id, { allowances: v, version: line.version })} />
      <MoneyCell value={line.tdsAmount} readOnly={readOnly} destructive testId={`line-tds-${line.id}`} onCommit={(v) => onPatch(line.id, { tdsAmount: v, version: line.version })} />
      {line.pfApplicable ? (
        <MoneyCell value={line.pfAmount} readOnly={readOnly} destructive testId={`line-pf-${line.id}`} onCommit={(v) => onPatch(line.id, { pfAmount: v, version: line.version })} />
      ) : (
        <td
          className="px-2.5 py-2.5 align-middle text-right text-[12.5px] text-faint"
          title="PF not applicable for this employee"
          data-testid={`line-pf-na-${line.id}`}
        >
          —
        </td>
      )}
      <MoneyCell value={line.advanceRecovery} readOnly={readOnly} destructive testId={`line-adv-${line.id}`} onCommit={(v) => onPatch(line.id, { advanceRecovery: v, version: line.version })} />
      <MoneyCell value={line.otherDeductions} readOnly={readOnly} destructive testId={`line-oth-${line.id}`} onCommit={(v) => onPatch(line.id, { otherDeductions: v, version: line.version })} />
      <td className="px-4 py-2.5 align-middle text-right font-mono tabular-nums text-[13px] font-bold text-foreground" data-testid={`line-net-${line.id}`}>
        {formatMoney(line.netAmount, { withSymbol: false })}
      </td>
      <td className="px-3 py-2.5 align-middle text-[11.5px]">
        {missingDim && (
          <span className="inline-block rounded-pill bg-destructive-soft px-2 py-0.5 text-destructive-ink" data-testid={`line-missing-dim-${line.id}`}>
            Missing dimension
          </span>
        )}
        {saving && !missingDim && (
          <span className="text-warning" data-testid={`line-saving-${line.id}`}>Saving…</span>
        )}
        {rowError && (
          <p className="mt-1 text-destructive" data-testid={`line-err-${line.id}`}>{rowError}</p>
        )}
      </td>
    </tr>
  );
}

function MoneyCell({
  value,
  readOnly,
  destructive,
  testId,
  onCommit,
}: {
  value: string;
  readOnly: boolean;
  /** Deduction cells (TDS/PF/Advance/Other) render red, matching the mockup's Deductions treatment. */
  destructive?: boolean;
  testId: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  if (readOnly) {
    return (
      <td
        className={cn(
          "px-2.5 py-2.5 align-middle text-right font-mono tabular-nums text-[12.5px]",
          destructive ? "text-destructive" : "text-foreground",
        )}
        data-testid={testId}
      >
        {formatMoney(value, { withSymbol: false })}
      </td>
    );
  }

  return (
    <td className="px-2 py-2 align-middle text-right">
      <Input
        className={cn(
          "h-8 text-right font-mono tabular-nums text-[12.5px]",
          destructive && "text-destructive",
        )}
        value={draft}
        invalid={!!error}
        data-testid={testId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const t = draft.trim();
          if (!/^\d*\.?\d*$/.test(t) || t === "" || Number(t) < 0) {
            setError("Can't be negative.");
            return;
          }
          setError(null);
          if (t !== value) onCommit(t);
        }}
      />
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </td>
  );
}
