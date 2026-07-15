"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { type SalarySheet } from "../api/salary";

/**
 * Balanced-preview panel (spec §5/§9; FR-HR-015). Shown BEFORE the confirm dialog can
 * submit. Sums the debit / credit sides from the sheet's lines and confirms Σdebit =
 * Σcredit; the "I've reviewed the balanced preview" checkbox gates the Post button.
 *
 * Dr: Gross Salary (Σ gross + Σ allowances) — cost centre Labour
 * Cr: Salary Payable (Σ net) + TDS + PF + Advance recovery + Other deductions
 *
 * NOTE: this is a preview only — the server is the source of truth for the entry that
 * actually posts. The panel's role is (a) let HR see what will hit the ledger, and (b)
 * surface a `MISSING_REQUIRED_DIMENSION` risk before Post is even attempted.
 */
export function PostPreviewPanel({
  sheet,
  confirmed,
  onConfirmChange,
  serverError,
}: {
  sheet: SalarySheet;
  confirmed: boolean;
  onConfirmChange: (v: boolean) => void;
  serverError?: string | null;
}) {
  let sumGross = toDecimal("0");
  let sumAllow = toDecimal("0");
  let sumTds = toDecimal("0");
  let sumPf = toDecimal("0");
  let sumAdv = toDecimal("0");
  let sumOther = toDecimal("0");
  let sumNet = toDecimal("0");
  let missingDim = 0;
  for (const l of sheet.lines) {
    sumGross = sumGross.plus(l.grossAmount);
    sumAllow = sumAllow.plus(l.allowances);
    sumTds = sumTds.plus(l.tdsAmount);
    sumPf = sumPf.plus(l.pfAmount);
    sumAdv = sumAdv.plus(l.advanceRecovery);
    sumOther = sumOther.plus(l.otherDeductions);
    sumNet = sumNet.plus(l.netAmount);
    if (!l.projectId || !l.costCentreId || !l.purposeId) missingDim += 1;
  }
  const debit = sumGross.plus(sumAllow);
  const credit = sumNet.plus(sumTds).plus(sumPf).plus(sumAdv).plus(sumOther);
  const balanced = debit.equals(credit);

  return (
    <Card className="p-4" data-testid="post-preview-panel" role="region" aria-live="polite">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[13.5px] font-bold text-foreground">Posting preview</h2>
        <span
          className={
            "inline-flex h-[22px] items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-semibold " +
            (balanced ? "bg-success-soft text-success-ink" : "bg-destructive-soft text-destructive-ink")
          }
          data-testid="preview-balanced"
        >
          {balanced ? "Balanced ✓" : "Unbalanced"}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Dr Gross Salary [+ Employer PF] / Cr Salary Payable + TDS + PF + Advance — cost centre Labour.
      </p>

      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Debit</div>
          <PreviewRow label="Gross salary" value={sumGross.toFixed(4)} testId="preview-dr-gross" />
          <PreviewRow label="Allowances" value={sumAllow.toFixed(4)} testId="preview-dr-allow" />
          <PreviewRow label="Σ Debit" value={debit.toFixed(4)} bold testId="preview-dr-total" />
        </div>
        <div className="rounded-card border border-border p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Credit</div>
          <PreviewRow label="Salary payable" value={sumNet.toFixed(4)} testId="preview-cr-net" />
          <PreviewRow label="TDS" value={sumTds.toFixed(4)} testId="preview-cr-tds" />
          <PreviewRow label="PF" value={sumPf.toFixed(4)} testId="preview-cr-pf" />
          <PreviewRow label="Advance" value={sumAdv.toFixed(4)} testId="preview-cr-adv" />
          <PreviewRow label="Other" value={sumOther.toFixed(4)} testId="preview-cr-oth" />
          <PreviewRow label="Σ Credit" value={credit.toFixed(4)} bold testId="preview-cr-total" />
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 rounded-card bg-surface-2 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">Σ Debit = Σ Credit</span>
        <span className={cn("ml-auto font-mono text-[12.5px] font-bold tabular-nums", balanced ? "text-success-ink" : "text-destructive")}>
          ৳ {formatMoney(debit.toFixed(4), { withSymbol: false })}
        </span>
      </div>

      {missingDim > 0 && (
        <Alert
          tone="destructive"
          className="mt-3"
          title="One or more lines is missing a project, cost centre, or purpose — fix the line before posting."
          data-testid="preview-missing-dim"
        />
      )}

      {serverError && <Alert tone="destructive" className="mt-3" title={serverError} data-testid="preview-server-err" />}

      <label className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-foreground">
        <Checkbox
          checked={confirmed}
          onChange={(e) => onConfirmChange(e.target.checked)}
          data-testid="preview-confirmed"
          aria-describedby="preview-help"
        />
        Preview confirmed — I&apos;ve reviewed the balanced Dr/Cr breakdown above.
      </label>
      <p id="preview-help" className="mt-1 text-[11px] text-faint">
        Post is only enabled after you confirm the preview. This mirrors the platform&apos;s voucher-post rigor.
      </p>
    </Card>
  );
}

function PreviewRow({
  label,
  value,
  bold,
  testId,
}: {
  label: string;
  value: string;
  bold?: boolean;
  testId?: string;
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span
        data-testid={testId}
        className={"font-mono tabular-nums " + (bold ? "text-[13.5px] font-bold text-foreground" : "text-[12.5px] text-foreground")}
      >
        ৳ {formatMoney(value, { withSymbol: false })}
      </span>
    </div>
  );
}
