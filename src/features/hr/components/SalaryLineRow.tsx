"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type SalarySheetLine, type SalaryLineUpdateInput } from "../api/salary";

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
  return (
    <tr
      className={cn("border-b border-muted", saving && "opacity-70")}
      data-testid={`salary-line-${line.id}`}
      data-line-status={readOnly ? "readonly" : "editable"}
    >
      <td className="px-3 py-2 align-top">
        <div className="text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">{line.employeeName}</div>
        <div className="text-[11.5px] text-muted-foreground">{line.employeeCode}</div>
      </td>
      <td className="px-3 py-2 align-top text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{projectLabel}</td>
      <td className="px-3 py-2 align-top text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{costCentreLabel}</td>
      <td className="px-3 py-2 align-top text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{purposeLabel}</td>
      <td className="px-3 py-2 align-top text-right font-mono tabular-nums text-[12.5px]">{line.paidDays}</td>
      <td className="px-3 py-2 align-top text-right font-mono tabular-nums text-[12.5px]" data-testid={`line-gross-${line.id}`}>
        {formatMoney(line.grossAmount, { withSymbol: false })}
      </td>
      <MoneyCell value={line.allowances} readOnly={readOnly} testId={`line-allow-${line.id}`} onCommit={(v) => onPatch(line.id, { allowances: v, version: line.version })} />
      <MoneyCell value={line.tdsAmount} readOnly={readOnly} testId={`line-tds-${line.id}`} onCommit={(v) => onPatch(line.id, { tdsAmount: v, version: line.version })} />
      {line.pfApplicable ? (
        <MoneyCell value={line.pfAmount} readOnly={readOnly} testId={`line-pf-${line.id}`} onCommit={(v) => onPatch(line.id, { pfAmount: v, version: line.version })} />
      ) : (
        <td className="px-3 py-2 align-top text-right text-[12px] text-faint" data-testid={`line-pf-na-${line.id}`}>—</td>
      )}
      <MoneyCell value={line.advanceRecovery} readOnly={readOnly} testId={`line-adv-${line.id}`} onCommit={(v) => onPatch(line.id, { advanceRecovery: v, version: line.version })} />
      <MoneyCell value={line.otherDeductions} readOnly={readOnly} testId={`line-oth-${line.id}`} onCommit={(v) => onPatch(line.id, { otherDeductions: v, version: line.version })} />
      <td className="px-3 py-2 align-top text-right font-mono tabular-nums text-[13px] font-semibold text-foreground" data-testid={`line-net-${line.id}`}>
        {formatMoney(line.netAmount, { withSymbol: false })}
      </td>
      <td className="px-3 py-2 align-top text-[11.5px]">
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
  testId,
  onCommit,
}: {
  value: string;
  readOnly: boolean;
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
      <td className="px-3 py-2 align-top text-right font-mono tabular-nums text-[12.5px]" data-testid={testId}>
        {formatMoney(value, { withSymbol: false })}
      </td>
    );
  }

  return (
    <td className="px-3 py-2 align-top text-right">
      <Input
        className="h-8 text-right font-mono tabular-nums text-[12.5px]"
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
